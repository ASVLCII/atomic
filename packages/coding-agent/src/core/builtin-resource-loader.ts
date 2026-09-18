import { realpathSync } from "node:fs";
import { relative, sep } from "node:path";
import { getBuiltinPackageLocations } from "./builtin-packages.ts";
import { getExtensionRuntimeEventBus, loadExtensions } from "./extensions/loader.ts";
import type { LoadExtensionsResult } from "./extensions/types.ts";
import { DefaultPackageManager, type ResolvedResource } from "./package-manager.ts";
import { DefaultResourceLoader } from "./resource-loader.ts";
import type {
	ResourceExtensionPaths,
	ResourceLoader,
	ResourceLoaderReloadOptions,
	ResourceLoaderReloadTransaction,
} from "./resource-loader-types.ts";
import { SettingsManager } from "./settings-manager.ts";
import { buildSkillCatalog } from "./skill-catalog.ts";

function canonical(path: string): string {
	try {
		return realpathSync(path);
	} catch {
		return path;
	}
}

/** Adds shipped resources without changing the caller's loader or its discovery options. */
class BuiltinResourceLoader implements ResourceLoader {
	private extensions!: LoadExtensionsResult;
	private assets: DefaultResourceLoader;
	private readonly delegate: ResourceLoader;
	private readonly cwd: string;
	private readonly agentDir: string;
	constructor(delegate: ResourceLoader, cwd: string, agentDir: string) {
		this.delegate = delegate;
		this.cwd = cwd;
		this.agentDir = agentDir;
		this.assets = new DefaultResourceLoader({
			cwd,
			agentDir,
			settingsManager: SettingsManager.inMemory(),
			noExtensions: true,
			noSkills: true,
			noPromptTemplates: true,
			noThemes: true,
			noContextFiles: true,
		});
	}
	async initialize(): Promise<void> {
		const locations = getBuiltinPackageLocations(true);
		const target = this.delegate.getExtensions();
		const identities = new Set<string>();
		const extensions = target.extensions.filter((extension) => {
			const path = canonical(extension.resolvedPath);
			const builtin = locations.find((location) => {
				const child = relative(canonical(location.packageDir), path);
				return child !== ".." && !child.startsWith(`..${sep}`) && !child.startsWith(sep);
			});
			if (!builtin) return true;
			if (identities.has(builtin.packageName)) return false;
			identities.add(builtin.packageName);
			return true;
		});
		const manager = new DefaultPackageManager({
			cwd: this.cwd,
			agentDir: this.agentDir,
			settingsManager: SettingsManager.inMemory(),
		});
		const resources = await manager.resolveExtensionSources(
			locations.map((location) => location.packageDir),
			{ temporary: true },
		);
		const paths = resources.extensions.filter(
			(resource) =>
				resource.enabled &&
				!locations.some(
					(location) =>
						identities.has(location.packageName) &&
						canonical(resource.path).startsWith(`${canonical(location.packageDir)}${sep}`),
				),
		);
		const loaded = await loadExtensions(
			paths.map((resource) => resource.path),
			this.cwd,
			getExtensionRuntimeEventBus(target.runtime),
			{ get: () => resources.workflows, refresh: async () => resources.workflows },
			target.runtime,
		);
		for (const extension of loaded.extensions) extension.sourceInfo.configurationOrigin = "bundled";
		this.extensions = {
			...target,
			extensions: [...extensions, ...loaded.extensions],
			errors: [...target.errors, ...loaded.errors],
		};
		const entries = (items: ResolvedResource[]) =>
			items
				.filter((item) => item.enabled)
				.map((item) => ({
					path: item.path,
					metadata: { ...item.metadata, configurationOrigin: "bundled" as const },
				}));
		await this.assets.extendResources({
			skillPaths: entries(resources.skills),
			promptPaths: entries(resources.prompts),
			themePaths: entries(resources.themes),
		});
	}
	getExtensions() {
		return this.extensions;
	}
	getSkills(): ReturnType<ResourceLoader["getSkills"]> {
		const caller = this.delegate.getSkills();
		const builtin = this.assets.getSkills();
		const paths = new Set(caller.skills.map((skill) => canonical(skill.filePath)));
		return {
			skills: [...caller.skills, ...builtin.skills.filter((skill) => !paths.has(canonical(skill.filePath)))],
			diagnostics: [...caller.diagnostics, ...builtin.diagnostics],
		};
	}
	getSkillCatalog() {
		return buildSkillCatalog(this.getSkills().skills);
	}
	getPrompts(): ReturnType<ResourceLoader["getPrompts"]> {
		const caller = this.delegate.getPrompts();
		const builtin = this.assets.getPrompts();
		const paths = new Set(caller.prompts.map((prompt) => canonical(prompt.filePath)));
		return {
			prompts: [...caller.prompts, ...builtin.prompts.filter((prompt) => !paths.has(canonical(prompt.filePath)))],
			diagnostics: [...caller.diagnostics, ...builtin.diagnostics],
		};
	}
	getThemes(): ReturnType<ResourceLoader["getThemes"]> {
		const caller = this.delegate.getThemes();
		const builtin = this.assets.getThemes();
		return {
			themes: [...caller.themes, ...builtin.themes],
			diagnostics: [...caller.diagnostics, ...builtin.diagnostics],
		};
	}
	getAgentsFiles() {
		return this.delegate.getAgentsFiles();
	}
	getSystemPrompt() {
		return this.delegate.getSystemPrompt();
	}
	getSystemPromptSource() {
		return this.delegate.getSystemPromptSource();
	}
	getAppendSystemPrompt() {
		return this.delegate.getAppendSystemPrompt();
	}
	getAppendSystemPromptSources() {
		return this.delegate.getAppendSystemPromptSources();
	}
	async extendResources(paths: ResourceExtensionPaths): Promise<void> {
		const bundled: ResourceExtensionPaths = {};
		const caller: ResourceExtensionPaths = {};
		for (const kind of ["skillPaths", "promptPaths", "themePaths"] as const) {
			bundled[kind] = paths[kind]?.filter((entry) => entry.metadata.configurationOrigin === "bundled");
			caller[kind] = paths[kind]?.filter((entry) => entry.metadata.configurationOrigin !== "bundled");
		}
		await this.delegate.extendResources(caller);
		await this.assets.extendResources(bundled);
	}
	async reload(options?: ResourceLoaderReloadOptions): Promise<void> {
		await this.delegate.reload(options);
		this.assets = new DefaultResourceLoader({
			cwd: this.cwd,
			agentDir: this.agentDir,
			settingsManager: SettingsManager.inMemory(),
			noContextFiles: true,
		});
		await this.initialize();
	}
	supportsTransactionalReload(): boolean {
		return this.delegate.prepareReload !== undefined && this.delegate.supportsTransactionalReload?.() !== false;
	}
	async prepareReload(
		settings: SettingsManager,
		options?: ResourceLoaderReloadOptions,
	): Promise<ResourceLoaderReloadTransaction> {
		if (!this.delegate.prepareReload) throw new Error("Resource loader does not support transactional reload");
		const transaction = await this.delegate.prepareReload(settings, options);
		const candidate = new BuiltinResourceLoader(transaction.loader, this.cwd, this.agentDir);
		await candidate.initialize();
		const publish = () => {
			this.extensions = candidate.extensions;
			this.assets = candidate.assets;
		};
		return {
			...transaction,
			loader: candidate,
			...(transaction.prepareCommit
				? {
						prepareCommit: () => {
							const prepared = transaction.prepareCommit!();
							return {
								commit: () => {
									prepared.commit();
									publish();
								},
								rollback: () => prepared.rollback(),
							};
						},
					}
				: {}),
			commit: () => {
				transaction.commit();
				publish();
			},
		};
	}
}

export async function withBuiltinResourceLoader(
	loader: ResourceLoader,
	cwd: string,
	agentDir: string,
): Promise<ResourceLoader> {
	if (loader instanceof BuiltinResourceLoader) return loader;
	const composed = new BuiltinResourceLoader(loader, cwd, agentDir);
	await composed.initialize();
	return composed;
}
