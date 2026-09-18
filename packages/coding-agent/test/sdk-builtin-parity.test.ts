import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getModel } from "@bastani/pi-ai/compat";
import { Type } from "typebox";
import { test, vi } from "vitest";
import * as config from "../src/config.js";
import { AgentSession } from "../src/core/agent-session.js";
import {
	createAgentSessionFromServices,
	createAgentSessionServices,
	createUnstartedAgentSessionFromServices,
} from "../src/core/agent-session-services.ts";
import { getBuiltinPackagePaths } from "../src/core/builtin-packages.ts";
import { noOpUIContext } from "../src/core/extensions/runner-ui.ts";
import { ModelRuntime } from "../src/core/model-runtime.js";
import { DefaultResourceLoader } from "../src/core/resource-loader.ts";
import { createAgentSession, createUnstartedAgentSession } from "../src/core/sdk.ts";
import type { AtomicBuiltin, CreateAgentSessionOptions } from "../src/core/sdk-types.ts";
import { SessionManager } from "../src/core/session-manager.ts";
import { SettingsManager } from "../src/core/settings-manager.ts";
import { getDefaultToolNames } from "../src/core/tools/index.ts";
import type {
	ExtensionBindings,
	ExtensionContext,
	HostDiagnostic,
	HostInput,
	HostInputOptions,
	QuestionnaireResult,
	QuestionParams,
} from "../src/index.js";

// #3105: the ordinary SDK factory, not CLI setup, supplies Atomic's shipped capabilities.
test("default SDK creation returns an Atomic AgentSession with builtin tools and resources", async () => {
	const cwd = mkdtempSync(join(tmpdir(), "atomic-sdk-parity-"));
	try {
		const { session, extensionsResult } = await createAgentSession({
			cwd,
			agentDir: join(cwd, "agent"),
			model: getModel("anthropic", "claude-sonnet-4-5")!,
			sessionManager: SessionManager.inMemory(cwd),
		});
		try {
			assert.ok(session instanceof AgentSession);
			for (const name of ["workflow", "subagent", "mcp", "intercom", "web_search", "fetch_content"]) {
				assert.ok(
					session.getAllTools().some((tool) => tool.name === name),
					`missing builtin ${name}`,
				);
				assert.ok(session.getActiveToolNames().includes(name), `inactive builtin ${name}`);
			}
			assert.equal(extensionsResult.errors.length, 0);
			assert.ok(session.systemPrompt.includes("<available_skills>"));
		} finally {
			await session.dispose();
		}
	} finally {
		rmSync(cwd, { recursive: true, force: true });
	}
});

// #3105: custom discovery remains caller-owned while Atomic supplies its builtins.
test("custom loaders retain their resources and factories while startup runs once", async () => {
	const cwd = mkdtempSync(join(tmpdir(), "atomic-sdk-custom-"));
	let starts = 0;
	const reasons: string[] = [];
	const settingsManager = SettingsManager.inMemory();
	const loader = new DefaultResourceLoader({
		cwd,
		agentDir: join(cwd, "agent"),
		settingsManager,
		noExtensions: true,
		noContextFiles: true,
		systemPrompt: "Caller-owned prompt",
		extensionFactories: [
			(pi) => {
				pi.on("session_start", async (event) => {
					await Promise.resolve();
					starts++;
					reasons.push(event.reason);
				});
			},
		],
	});
	await loader.reload();
	const originalExtensions = [...loader.getExtensions().extensions];
	const options = Object.freeze({
		cwd,
		agentDir: join(cwd, "agent"),
		resourceLoader: loader,
		settingsManager,
		sessionManager: SessionManager.inMemory(cwd),
		model: getModel("anthropic", "claude-sonnet-4-5")!,
	});
	try {
		const { session } = await createAgentSession(options);
		try {
			assert.equal(starts, 1);
			// #3105: mandatory composition must reuse the genuine overlay registration.
			const builtins = session.resourceLoader
				.getExtensions()
				.extensions.filter((extension) => extension.sourceInfo.configurationOrigin === "bundled");
			assert.equal(builtins.length, 5);
			assert.equal(new Set(builtins.map((extension) => extension.resolvedPath)).size, 5);
			assert.ok(session.getAllTools().some((tool) => tool.name === "workflow"));
			assert.ok(session.systemPrompt.startsWith("Caller-owned prompt"));
			assert.deepEqual(loader.getExtensions().extensions, originalExtensions);
			await Promise.all([session.bindExtensions({}), session.bindExtensions({})]);
			assert.equal(starts, 1);
			await session.reload();
			await session.bindExtensions({});
			assert.equal(
				session.resourceLoader
					.getExtensions()
					.extensions.filter((extension) => extension.sourceInfo.configurationOrigin === "bundled").length,
				5,
			);
			assert.deepEqual(reasons, ["startup", "reload"]);
		} finally {
			await session.dispose();
		}
	} finally {
		rmSync(cwd, { recursive: true, force: true });
	}
});

// #3105: CLI services and the direct SDK share default composition.
test("CLI service creation supplies the same default builtin families", async () => {
	const cwd = mkdtempSync(join(tmpdir(), "atomic-sdk-services-"));
	try {
		const services = await createAgentSessionServices({ cwd, agentDir: join(cwd, "agent") });
		const { session } = await createAgentSessionFromServices({
			services,
			sessionManager: SessionManager.inMemory(cwd),
			model: getModel("anthropic", "claude-sonnet-4-5")!,
		});
		try {
			for (const name of ["workflow", "subagent", "mcp", "intercom", "web_search"])
				assert.ok(session.getActiveToolNames().includes(name), name);
		} finally {
			await session.dispose();
		}
	} finally {
		rmSync(cwd, { recursive: true, force: true });
	}
});

// #3105: absence is an installation error, never a bare-agent fallback.
test("missing shipped builtin assets reject with the package identity", async () => {
	const cwd = mkdtempSync(join(tmpdir(), "atomic-sdk-missing-"));
	const packageDir = vi.spyOn(config, "getPackageDir").mockReturnValue(cwd);
	try {
		await assert.rejects(
			createAgentSession({ cwd, agentDir: join(cwd, "agent"), sessionManager: SessionManager.inMemory(cwd) }),
			(error: Error & { code?: string }) =>
				error.code === "BuiltinUnavailable" && error.message.includes("@bastani/workflows"),
		);
		const { session } = await createAgentSession({
			cwd,
			agentDir: join(cwd, "agent"),
			sessionManager: SessionManager.inMemory(cwd),
			builtins: { workflows: false, subagents: false, mcp: false, "web-access": false, intercom: false },
		});
		try {
			assert.equal(session.resourceLoader.getExtensions().extensions.length, 0);
			assert.ok(session.getActiveToolNames().includes("read"));
		} finally {
			await session.dispose();
		}
	} finally {
		packageDir.mockRestore();
		rmSync(cwd, { recursive: true, force: true });
	}
});

// #3105: failing startup must await every acquired extension's shutdown before rejection.
test("failed startup awaits rollback and never returns a partially started session", async () => {
	const cwd = mkdtempSync(join(tmpdir(), "atomic-sdk-rollback-"));
	const events: string[] = [];
	const modelRuntime = await ModelRuntime.create({ authPath: join(cwd, "auth.json"), modelsPath: null });
	const loader = new DefaultResourceLoader({
		cwd,
		agentDir: join(cwd, "agent"),
		settingsManager: SettingsManager.inMemory(),
		noExtensions: true,
		noContextFiles: true,
		extensionFactories: [
			(pi) => {
				pi.on("session_start", (_event, ctx) => {
					events.push(`start:${ctx.mode}`);
					pi.registerProvider("startup-provider", {
						apiKey: "fixture",
						baseUrl: "https://example.invalid",
						api: "openai-completions",
						models: [],
					});
				});
				pi.on("session_shutdown", async () => {
					await Promise.resolve();
					events.push("released");
				});
			},
			(pi) => {
				pi.on("session_start", () => {
					throw new Error("injected startup failure");
				});
				pi.on("session_shutdown", async () => {
					await Promise.resolve();
					events.push("failed-extension-released");
				});
			},
		],
	});
	await loader.reload();
	try {
		await assert.rejects(
			createAgentSession({
				cwd,
				agentDir: join(cwd, "agent"),
				resourceLoader: loader,
				modelRuntime,
				sessionManager: SessionManager.inMemory(cwd),
				extensionBindings: { mode: "rpc" },
			}),
			/Extension startup failed/,
		);
		assert.deepEqual(events, ["start:rpc", "released", "failed-extension-released"]);
		assert.equal(modelRuntime.getRegisteredProviderConfig("startup-provider"), undefined);
	} finally {
		rmSync(cwd, { recursive: true, force: true });
	}
});

// #3105: repeated references to shipped identities do not install duplicate factories.
test("repeated shipped roots and loader identities compose once without rewriting caller arrays", async () => {
	const cwd = mkdtempSync(join(tmpdir(), "atomic-sdk-dedup-"));
	const roots = getBuiltinPackagePaths();
	const builtinPackagePaths = [...roots, ...roots];
	const originalPaths = [...builtinPackagePaths];
	const loader = new DefaultResourceLoader({
		cwd,
		agentDir: join(cwd, "agent"),
		builtinPackagePaths,
		settingsManager: SettingsManager.inMemory(),
		noContextFiles: true,
	});
	await loader.reload();
	const loaded = loader.getExtensions();
	const repeated = [...loaded.extensions, ...loaded.extensions];
	const caller: DefaultResourceLoader = Object.create(loader);
	caller.getExtensions = () => ({ ...loaded, extensions: repeated });
	try {
		const { session, extensionsResult } = await createAgentSession({
			cwd,
			agentDir: join(cwd, "agent"),
			resourceLoader: caller,
			sessionManager: SessionManager.inMemory(cwd),
		});
		try {
			assert.equal(extensionsResult.extensions.length, roots.length);
			assert.deepEqual(builtinPackagePaths, originalPaths);
			assert.equal(caller.getExtensions().extensions, repeated);
			assert.equal(repeated.length, roots.length * 2);
			assert.deepEqual(
				extensionsResult.extensions.map((extension) => extension.resolvedPath),
				loaded.extensions.map((extension) => extension.resolvedPath),
			);
		} finally {
			await session.dispose();
		}
	} finally {
		rmSync(cwd, { recursive: true, force: true });
	}
});

// #3105: the internal CLI construction cycle mounts the real host before the same once-only startup.
for (const fail of [false, true]) {
	test(`deferred CLI first binding ${fail ? "awaits failure rollback" : "starts with the mounted host once"}`, async () => {
		const cwd = mkdtempSync(join(tmpdir(), "atomic-cli-start-"));
		const events: string[] = [];
		try {
			const services = await createAgentSessionServices({
				cwd,
				agentDir: join(cwd, "agent"),
				resourceLoaderOptions: {
					extensionFactories: [
						(pi) => {
							pi.on("session_start", async (_event, ctx) => {
								events.push(`${ctx.mode}:${ctx.hasUI}`);
								assert.equal(await ctx.ui.confirm("startup", "mounted host"), true);
								if (fail) throw new Error("deferred startup failure");
							});
							pi.on("session_shutdown", async () => {
								await Promise.resolve();
								events.push("released");
							});
						},
					],
				},
			});
			const { session } = await createUnstartedAgentSessionFromServices({
				services,
				sessionManager: SessionManager.inMemory(cwd),
			});
			try {
				assert.deepEqual(events, []);
				const binding = { mode: "tui" as const, uiContext: { ...noOpUIContext, confirm: async () => true } };
				if (fail) {
					await assert.rejects(session.bindExtensions(binding), /Extension startup failed/);
					assert.deepEqual(events, ["tui:true", "released"]);
					await assert.rejects(session.bindExtensions(binding), /Extension startup failed/);
					assert.deepEqual(events, ["tui:true", "released"]);
				} else {
					await session.bindExtensions(binding);
					await session.bindExtensions(binding);
					assert.deepEqual(events, ["tui:true"]);
				}
			} finally {
				await session.dispose();
			}
		} finally {
			rmSync(cwd, { recursive: true, force: true });
		}
	});
}

// #3105: the public services factory retains eager startup and forwards host bindings.
test("services factory forwards bindings before startup", async () => {
	const cwd = mkdtempSync(join(tmpdir(), "atomic-services-bind-"));
	const modes: string[] = [];
	try {
		const services = await createAgentSessionServices({
			cwd,
			agentDir: join(cwd, "agent"),
			resourceLoaderOptions: {
				extensionFactories: [
					(pi) => {
						pi.on("session_start", (_event, ctx) => {
							modes.push(ctx.mode);
						});
					},
				],
			},
		});
		const { session } = await createAgentSessionFromServices({
			services,
			sessionManager: SessionManager.inMemory(cwd),
			extensionBindings: { mode: "rpc" },
		});
		try {
			assert.deepEqual(modes, ["rpc"]);
		} finally {
			await session.dispose();
		}
	} finally {
		rmSync(cwd, { recursive: true, force: true });
	}
});

// #3105: resource discovery is not the end of fallible creation finalization.
test.each([false, true])("prompt finalization failure rolls back once (deferred=%s)", async (deferred) => {
	const cwd = mkdtempSync(join(tmpdir(), "atomic-sdk-finalization-"));
	const events: string[] = [];
	let discovered = false;
	const settingsManager = SettingsManager.inMemory();
	const loader = new DefaultResourceLoader({
		cwd,
		agentDir: join(cwd, "agent"),
		settingsManager,
		noExtensions: true,
		noContextFiles: true,
		extensionFactories: [
			(pi) => {
				pi.on("session_start", () => {
					events.push("acquire");
				});
				pi.on("resources_discover", () => {
					discovered = true;
					return {};
				});
				pi.on("session_shutdown", async () => {
					await Promise.resolve();
					events.push("release");
				});
			},
		],
	});
	await loader.reload();
	const options = {
		cwd,
		agentDir: join(cwd, "agent"),
		resourceLoader: loader,
		settingsManager,
		sessionManager: SessionManager.inMemory(cwd),
		systemPromptTransform: (prompt: string) => {
			if (discovered) throw new Error("post-discovery prompt failure");
			return prompt;
		},
	};
	try {
		if (deferred) {
			const { session } = await createUnstartedAgentSession(options);
			await assert.rejects(session.bindExtensions({}), /post-discovery prompt failure/);
			await assert.rejects(session.bindExtensions({}), /post-discovery prompt failure/);
		} else {
			await assert.rejects(createAgentSession(options), /post-discovery prompt failure/);
		}
		assert.deepEqual(events, ["acquire", "release"]);
	} finally {
		rmSync(cwd, { recursive: true, force: true });
	}
});

// #3105: constructor failures restore borrowed provider state before rejecting.
test("constructor failure restores new and replaced providers without starting a session", async () => {
	const cwd = mkdtempSync(join(tmpdir(), "atomic-sdk-constructor-"));
	const modelRuntime = await ModelRuntime.create({ authPath: join(cwd, "auth.json"), modelsPath: null });
	const original = {
		apiKey: "original",
		baseUrl: "https://original.invalid",
		api: "openai-completions" as const,
		models: [],
	};
	modelRuntime.registerProvider("existing-provider", original);
	const events: string[] = [];
	const settingsManager = SettingsManager.inMemory();
	const loader = new DefaultResourceLoader({
		cwd,
		agentDir: join(cwd, "agent"),
		settingsManager,
		noExtensions: true,
		noContextFiles: true,
		extensionFactories: [
			(pi) => {
				pi.registerProvider("existing-provider", { ...original, apiKey: "replacement" });
				pi.registerProvider("constructor-provider", original);
				pi.on("session_start", () => {
					events.push("start");
				});
			},
		],
	});
	await loader.reload();
	try {
		await assert.rejects(
			createAgentSession({
				cwd,
				agentDir: join(cwd, "agent"),
				resourceLoader: loader,
				modelRuntime,
				settingsManager,
				sessionManager: SessionManager.inMemory(cwd),
				systemPromptTransform: () => {
					throw new Error("constructor transform failed");
				},
			}),
			/constructor transform failed/,
		);
		assert.equal(modelRuntime.getRegisteredProviderConfig("constructor-provider"), undefined);
		assert.deepEqual(modelRuntime.getRegisteredProviderConfig("existing-provider"), original);
		assert.deepEqual(events, []);
	} finally {
		rmSync(cwd, { recursive: true, force: true });
	}
});

// #3105: explicit suppression applies equally to coding and extension tools after reload.
test("noTools all suppresses Intercom and remains empty after reload", async () => {
	const cwd = mkdtempSync(join(tmpdir(), "atomic-sdk-selection-"));
	try {
		const { session } = await createAgentSession({
			cwd,
			agentDir: join(cwd, "agent"),
			settingsManager: SettingsManager.inMemory(),
			sessionManager: SessionManager.inMemory(cwd),
			noTools: "all",
			tools: ["read", "intercom"],
		});
		try {
			assert.deepEqual(session.getActiveToolNames(), []);
			await session.reload();
			assert.deepEqual(session.getActiveToolNames(), []);
		} finally {
			await session.dispose();
		}
	} finally {
		rmSync(cwd, { recursive: true, force: true });
	}
});

// #3105: flag lookup must not require own enumerable properties, including after reload.
test.each(["inherited getter", "nonenumerable"])("builtin %s false flags survive reload", async (shape) => {
	const cwd = mkdtempSync(join(tmpdir(), "atomic-sdk-flag-shape-"));
	class Selection {
		workflows = false;
		mcp = false;
		"web-access" = false;
		intercom = false;
		get subagents() {
			return false;
		}
	}
	const builtins: Partial<Record<AtomicBuiltin, boolean>> = new Selection();
	if (shape === "nonenumerable") Object.defineProperty(builtins, "subagents", { value: false, enumerable: false });
	Object.freeze(builtins);
	const descriptors = Object.getOwnPropertyDescriptors(builtins);
	const prototype = Object.getPrototypeOf(builtins);
	try {
		const { session } = await createAgentSession({
			cwd,
			agentDir: join(cwd, "agent"),
			builtins,
			settingsManager: SettingsManager.inMemory(),
			sessionManager: SessionManager.inMemory(cwd),
		});
		try {
			for (let generation = 0; generation < 2; generation++) {
				assert.equal(session.resourceLoader.getExtensions().extensions.length, 0);
				assert.equal(session.resourceLoader.getSkills().skills.length, 0);
				assert.ok(session.getActiveToolNames().includes("read"));
				assert.equal(
					session.getAllTools().some((tool) => tool.name === "subagent"),
					false,
				);
				assert.deepEqual(Object.getOwnPropertyDescriptors(builtins), descriptors);
				assert.equal(Object.getPrototypeOf(builtins), prototype);
				if (generation === 0) await session.reload();
			}
		} finally {
			await session.dispose();
		}
	} finally {
		rmSync(cwd, { recursive: true, force: true });
	}
});

// #3105: package suppression removes resources as well as tools across generations.
test.each(["preferred", "dist"])(
	"disabled builtins stay absent with %s custom discovery and reload",
	async (layout) => {
		const cwd = mkdtempSync(join(tmpdir(), "atomic-sdk-disabled-"));
		const settingsManager = SettingsManager.inMemory();
		const loader = new DefaultResourceLoader({
			cwd,
			agentDir: join(cwd, "agent"),
			settingsManager,
			builtinPackagePaths:
				layout === "preferred"
					? getBuiltinPackagePaths()
					: [join(config.getPackageDir(), "dist", "builtin", "subagents")],
			noContextFiles: true,
		});
		await loader.reload();
		const original = [...loader.getExtensions().extensions];
		assert.ok(original.length > 0, "the supplied shipped extension must actually be loaded");
		const originalArray = loader.getExtensions().extensions;
		const originalSkills = loader.getSkills().skills;
		const builtins = Object.freeze({
			workflows: false,
			subagents: false,
			mcp: false,
			"web-access": false,
			intercom: false,
		});
		try {
			const { session } = await createAgentSession({
				cwd,
				agentDir: join(cwd, "agent"),
				settingsManager,
				sessionManager: SessionManager.inMemory(cwd),
				resourceLoader: loader,
				builtins,
			});
			try {
				for (let generation = 0; generation < 2; generation++) {
					assert.equal(session.resourceLoader.getExtensions().extensions.length, 0);
					assert.equal(session.resourceLoader.getSkills().skills.length, 0);
					assert.equal(session.resourceLoader.getPrompts().prompts.length, 0);
					assert.ok(session.getActiveToolNames().includes("read"));
					assert.ok(!session.getActiveToolNames().includes("intercom"));
					if (generation === 0) {
						assert.deepEqual(loader.getExtensions().extensions, original);
						assert.equal(loader.getExtensions().extensions, originalArray);
						assert.equal(loader.getSkills().skills, originalSkills);
						await session.reload();
					}
				}
			} finally {
				await session.dispose();
			}
		} finally {
			rmSync(cwd, { recursive: true, force: true });
		}
	},
);

const extensionToolNames = [
	"workflow",
	"subagent",
	"mcp",
	"web_search",
	"code_search",
	"fetch_content",
	"get_search_content",
	"intercom",
];
// #3105: active selection is independent from composition and must survive reload unchanged.
test.each<{
	name: string;
	options: Pick<CreateAgentSessionOptions, "tools" | "noTools" | "excludedTools">;
	defaults?: string[];
	expected: string[];
}>([
	{
		name: "omitted selection",
		options: {},
		expected: [...getDefaultToolNames(), ...extensionToolNames, "custom_probe"],
	},
	{ name: "empty allowlist", options: { tools: [] }, expected: [] },
	{ name: "all without allowlist", options: { noTools: "all" }, expected: [] },
	{ name: "builtin suppression", options: { noTools: "builtin" }, expected: [...extensionToolNames, "custom_probe"] },
	{
		name: "builtin with explicit allowlist",
		options: { noTools: "builtin", tools: ["read", "intercom"] },
		expected: ["read", "intercom"],
	},
	{ name: "empty configured defaults", options: {}, defaults: [], expected: [...extensionToolNames, "custom_probe"] },
	{
		name: "configured coding defaults",
		options: {},
		defaults: ["read"],
		expected: ["read", ...extensionToolNames, "custom_probe"],
	},
	{
		name: "explicit beats configured defaults",
		options: { tools: ["custom_probe", "intercom"] },
		defaults: ["read"],
		expected: ["custom_probe", "intercom"],
	},
	{
		name: "exclusions win",
		options: { tools: ["read", "intercom", "custom_probe"], excludedTools: ["intercom", "custom_probe", "unknown"] },
		expected: ["read"],
	},
	{
		name: "unknown exclusions ignored",
		options: { tools: ["intercom", "read"], excludedTools: ["unknown"] },
		expected: ["intercom", "read"],
	},
])("tool selection: $name", async ({ options, defaults, expected }) => {
	const cwd = mkdtempSync(join(tmpdir(), "atomic-sdk-matrix-"));
	const snapshot = structuredClone(options);
	if (options.tools) Object.freeze(options.tools);
	if (options.excludedTools) Object.freeze(options.excludedTools);
	Object.freeze(options);
	try {
		const { session } = await createAgentSession({
			...options,
			cwd,
			agentDir: join(cwd, "agent"),
			settingsManager: SettingsManager.inMemory(defaults === undefined ? {} : { defaultTools: defaults }),
			sessionManager: SessionManager.inMemory(cwd),
			customTools: [
				{
					name: "custom_probe",
					label: "Probe",
					description: "Custom selection probe",
					parameters: Type.Object({}),
					execute: async () => ({ content: [{ type: "text", text: "ok" }], details: {} }),
				},
			],
		});
		try {
			assert.deepEqual([...session.getActiveToolNames()].sort(), [...expected].sort());
			if (options.tools && options.noTools !== "all") assert.deepEqual(session.getActiveToolNames(), expected);
			assert.ok(session.resourceLoader.getExtensions().extensions.length >= 5);
			await session.reload();
			assert.deepEqual([...session.getActiveToolNames()].sort(), [...expected].sort());
			for (const excluded of options.excludedTools ?? [])
				assert.equal(session.getToolDefinition(excluded), undefined);
			assert.deepEqual(options, snapshot);
		} finally {
			await session.dispose();
		}
	} finally {
		rmSync(cwd, { recursive: true, force: true });
	}
});

// #3105: omitted keys, empty selection and explicit true all retain shipped descriptor order.
test.each<Partial<Record<AtomicBuiltin, boolean>>>([
	{},
	{ workflows: true, subagents: true, mcp: true, "web-access": true, intercom: true },
	{ workflows: false },
	{ subagents: false },
	{ mcp: false },
	{ "web-access": false },
	{ intercom: false },
])("builtin selection %j preserves enabled families after reload", async (builtins) => {
	const cwd = mkdtempSync(join(tmpdir(), "atomic-sdk-builtins-"));
	Object.freeze(builtins);
	try {
		const { session } = await createAgentSession({
			cwd,
			agentDir: join(cwd, "agent"),
			builtins,
			settingsManager: SettingsManager.inMemory(),
			sessionManager: SessionManager.inMemory(cwd),
		});
		try {
			for (let generation = 0; generation < 2; generation++) {
				for (const [family, tool] of [
					["workflows", "workflow"],
					["subagents", "subagent"],
					["mcp", "mcp"],
					["web-access", "web_search"],
					["intercom", "intercom"],
				] as const) {
					assert.equal(session.getActiveToolNames().includes(tool), builtins[family] !== false, family);
				}
				if (generation === 0) await session.reload();
			}
		} finally {
			await session.dispose();
		}
	} finally {
		rmSync(cwd, { recursive: true, force: true });
	}
});

// #3105: a Node callback, without a terminal, answers the existing questionnaire tool.
test("SDK host callback answers a questionnaire without rendering", async () => {
	const cwd = mkdtempSync(join(tmpdir(), "atomic-host-input-"));
	const params = {
		questions: [
			{
				question: "Choose?",
				header: "Choice",
				options: [
					{ label: "Yes", description: "Proceed" },
					{ label: "No", description: "Decline" },
				],
			},
		],
	};
	const answer: QuestionnaireResult = {
		answers: [{ questionIndex: 0, question: "Choose?", kind: "option", answer: "Yes" }],
		cancelled: false,
	};
	try {
		const { session } = await createAgentSession({
			cwd,
			agentDir: join(cwd, "agent"),
			sessionManager: SessionManager.inMemory(cwd),
			settingsManager: SettingsManager.inMemory(),
			model: getModel("anthropic", "claude-sonnet-4-5")!,
			builtins: { workflows: false, subagents: false, mcp: false, intercom: false, "web-access": false },
			extensionBindings: {
				humanInput: {
					confirm: async () => false,
					select: async () => undefined,
					input: async () => "",
					editor: async () => "",
					questionnaire: async (received, options) => {
						assert.deepEqual(received, params);
						assert.equal(options.sessionId, session.sessionId);
						assert.ok(options.requestId);
						return answer;
					},
				},
			},
		});
		try {
			const tool = session.agent.state.tools.find((entry) => entry.name === "ask_user_question")!;
			const result = await tool.execute("question", params, new AbortController().signal);
			assert.deepEqual(result.details, answer);
		} finally {
			await session.dispose();
		}
	} finally {
		rmSync(cwd, { recursive: true, force: true });
	}
});

const callbackHost = (overrides: Partial<HostInput> = {}): HostInput => ({
	confirm: async () => false,
	select: async () => undefined,
	input: async () => "",
	editor: async () => "",
	questionnaire: async () => ({ answers: [], cancelled: true }),
	...overrides,
});

async function hostSession(bindings: ExtensionBindings = {}, options: CreateAgentSessionOptions = {}) {
	const cwd = mkdtempSync(join(tmpdir(), "atomic-host-contract-"));
	const contexts: ExtensionContext[] = [];
	const settingsManager = SettingsManager.inMemory();
	const loader = new DefaultResourceLoader({
		cwd,
		agentDir: join(cwd, "agent"),
		settingsManager,
		noExtensions: true,
		noContextFiles: true,
		extensionFactories: [
			(pi) => {
				pi.on("session_start", (_event, context) => {
					contexts.push(context);
				});
				pi.registerCommand("diagnostic-test", {
					description: "fixture",
					handler: async () => {
						throw new Error("secret prompt token");
					},
				});
			},
		],
	});
	await loader.reload();
	try {
		const { session } = await createAgentSession({
			cwd,
			agentDir: join(cwd, "agent"),
			settingsManager,
			resourceLoader: loader,
			sessionManager: SessionManager.inMemory(cwd),
			model: getModel("anthropic", "claude-sonnet-4-5")!,
			builtins: { workflows: false, subagents: false, mcp: false, intercom: false, "web-access": false },
			extensionBindings: bindings,
			...options,
		});
		return {
			session,
			contexts,
			loader,
			close: async () => {
				await session.dispose();
				rmSync(cwd, { recursive: true, force: true });
			},
		};
	} catch (error) {
		rmSync(cwd, { recursive: true, force: true });
		throw error;
	}
}

// #3105: host cancellation is runtime-owned even when callbacks never cooperate.
test("SDK abort cancels host input and ignores late approval", async () => {
	let identity: HostInputOptions | undefined;
	let approve!: (value: boolean) => void;
	const fixture = await hostSession({
		humanInput: callbackHost({
			confirm: async (_title, _message, options) => {
				identity = options;
				return new Promise<boolean>((resolve) => {
					approve = resolve;
				});
			},
		}),
	});
	try {
		const pending = fixture.contexts[0].ui.confirm("Approve", "Run?");
		const rejected = assert.rejects(pending, { code: "HumanInputCancelled" });
		await Promise.resolve();
		await fixture.session.abort();
		await rejected;
		assert.equal(identity?.signal.aborted, true);
		approve(true);
		await fixture.session.bindExtensions({ humanInput: callbackHost() });
		assert.equal(await fixture.contexts[0].ui.confirm("Again", "Run?"), false);
	} finally {
		await fixture.close();
	}
});

// #3105: creation, omitted rebinding, explicit override and null are distinct.
test("SDK human capability is separate from rendering and binding preserves pending requests", async () => {
	let resolve!: (value: string) => void;
	const ui = {
		...noOpUIContext,
		input: async () =>
			new Promise<string>((done) => {
				resolve = done;
			}),
	};
	const fixture = await hostSession({ uiContext: ui });
	try {
		const context = fixture.contexts[0];
		assert.equal(context.hasUI, true);
		assert.equal(context.hasHumanInput, true);
		const pending = context.ui.input("Raw");
		await Promise.resolve();
		await fixture.session.bindExtensions({});
		resolve("  unchanged\n");
		assert.equal(await pending, "  unchanged\n");
		assert.equal(fixture.contexts.length, 1);
		await fixture.session.bindExtensions({ humanInput: callbackHost({ input: async () => "" }) });
		assert.equal(await context.ui.input("Raw"), "");
		await fixture.session.bindExtensions({ humanInput: null });
		assert.equal(context.hasUI, true);
		assert.equal(context.hasHumanInput, false);
		await assert.rejects(context.ui.confirm("No", "Approval"), { code: "HumanInputUnavailable" });
		await fixture.session.bindExtensions({ uiContext: ui });
		assert.equal(context.hasHumanInput, false);
	} finally {
		await fixture.close();
	}
});

// #3105: runtime validation is not TypeScript trust or truthy coercion.
test("SDK dialogs preserve raw arguments and reject malformed host replies", async () => {
	const identities: HostInputOptions[] = [];
	const choices = [" same ", "same", " same ", ""];
	const fixture = await hostSession({
		humanInput: callbackHost({
			confirm: async (title, message, options) => {
				assert.equal(title, "  title\n");
				assert.equal(message, "");
				identities.push(options);
				return false;
			},
			select: async (title, values, options) => {
				assert.equal(title, "");
				assert.deepEqual(values, choices);
				identities.push(options);
				return "";
			},
			input: async (_title, placeholder) => {
				assert.equal(placeholder, "  ");
				return "";
			},
			editor: async (_title, initial) => {
				assert.equal(initial, "\n raw ");
				return "\n raw ";
			},
		}),
	});
	try {
		const ctx = fixture.contexts[0];
		assert.equal(ctx.hasUI, false);
		assert.equal(ctx.hasHumanInput, true);
		assert.equal(await ctx.ui.confirm("  title\n", ""), false);
		assert.equal(await ctx.ui.select("", choices), "");
		assert.equal(await ctx.ui.input("", "  "), "");
		assert.equal(await ctx.ui.editor("", "\n raw "), "\n raw ");
		assert.notEqual(identities[0].requestId, identities[1].requestId);
		for (const identity of identities) {
			assert.deepEqual(Object.keys(identity).sort(), ["requestId", "sessionId", "signal"]);
			assert.equal(identity.sessionId, fixture.session.sessionId);
		}
		for (const invalid of ["true", 1, undefined, null]) {
			await fixture.session.bindExtensions({ humanInput: callbackHost({ confirm: async () => invalid as never }) });
			await assert.rejects(ctx.ui.confirm("", ""), { code: "InvalidHostInput" });
		}
		await fixture.session.bindExtensions({
			humanInput: callbackHost({
				select: async () => "foreign",
				input: async () => 1 as never,
				editor: async () => false as never,
			}),
		});
		await assert.rejects(ctx.ui.select("", choices), { code: "InvalidHostInput" });
		await assert.rejects(ctx.ui.input(""), { code: "InvalidHostInput" });
		await assert.rejects(ctx.ui.editor(""), { code: "InvalidHostInput" });
		await assert.rejects(
			ctx.ui.custom(async () => {
				throw new Error("must not mount");
			}),
			{ code: "HumanInputUnavailable" },
		);
	} finally {
		await fixture.close();
	}
});

// #3105: caller cancellation, timeout, rejection, withdrawal and generations cannot approve.
test("SDK pending host requests settle at each cancellation boundary", async () => {
	const fixture = await hostSession();
	try {
		await assert.rejects(fixture.contexts[0].ui.input(""), { code: "HumanInputUnavailable" });
		for (const boundary of ["signal", "timeout", "withdraw", "reload", "dispose"] as const) {
			let identity!: HostInputOptions;
			let answer!: (value: boolean) => void;
			await fixture.session.bindExtensions({
				humanInput: callbackHost({
					confirm: async (_t, _m, options) => {
						identity = options;
						return new Promise<boolean>((resolve) => {
							answer = resolve;
						});
					},
				}),
			});
			const context = fixture.contexts.at(-1)!;
			const controller = new AbortController();
			const pending = context.ui.confirm("", "", {
				signal: controller.signal,
				...(boundary === "timeout" ? { timeout: 0 } : {}),
			});
			const rejected = assert.rejects(pending, { code: "HumanInputCancelled" });
			await Promise.resolve();
			if (boundary === "signal") controller.abort();
			if (boundary === "withdraw") await fixture.session.bindExtensions({ humanInput: null });
			if (boundary === "reload") await fixture.session.reload();
			if (boundary === "dispose") await fixture.session.dispose();
			await rejected;
			assert.equal(identity.signal.aborted, true);
			answer(true);
			if (boundary === "reload") {
				assert.throws(() => context.hasHumanInput);
				assert.equal(fixture.contexts.at(-1)!.hasHumanInput, true);
			}
		}
		await assert.rejects(fixture.session.bindExtensions({}), { code: "SessionClosed" });
	} finally {
		await fixture.close();
	}
	const failure = new Error("adapter refused");
	const rejected = await hostSession({
		humanInput: callbackHost({
			confirm: async () => {
				throw failure;
			},
		}),
	});
	try {
		await assert.rejects(rejected.contexts[0].ui.confirm("", ""), (error) => error === failure);
	} finally {
		await rejected.close();
	}
});

// #3105: exact questionnaire result types and schema failures survive the Node bridge.
test("SDK questionnaire preserves rich answers and rejects malformed results and request schemas", async () => {
	const params: QuestionParams = {
		questions: [
			{
				question: " Raw? ",
				header: "",
				options: [
					{ label: " yes ", description: "", preview: "\n## Preview\n" },
					{ label: "no", description: "" },
				],
			},
		],
	};
	const result: QuestionnaireResult = {
		answers: [
			{
				questionIndex: 0,
				question: " Raw? ",
				kind: "option",
				answer: " yes ",
				preview: "\n## Preview\n",
				notes: " raw notes ",
			},
		],
		cancelled: false,
	};
	let calls = 0;
	const fixture = await hostSession({
		humanInput: callbackHost({
			questionnaire: async (received) => {
				calls++;
				assert.deepEqual(received, params);
				return result;
			},
		}),
	});
	try {
		const execute = (request: QuestionParams) =>
			fixture.session.agent.state.tools
				.find((tool) => tool.name === "ask_user_question")!
				.execute("question", request, new AbortController().signal);
		assert.deepEqual((await execute(params)).details, result);
		assert.equal(calls, 1);
		for (const [request, error] of [
			[{ questions: [] }, "no_questions"],
			[{ questions: [params.questions[0], params.questions[0]] }, "duplicate_question"],
			[
				{
					questions: [
						{ ...params.questions[0], options: [params.questions[0].options[0], params.questions[0].options[0]] },
					],
				},
				"duplicate_option_label",
			],
			[
				{
					questions: [
						{
							...params.questions[0],
							options: [{ label: "Other", description: "" }, params.questions[0].options[1]],
						},
					],
				},
				"reserved_label",
			],
		] as const) {
			const response = await execute(request as QuestionParams);
			assert.equal((response.details as QuestionnaireResult).error, error);
		}
		assert.equal(calls, 1);
		for (const malformed of [
			null,
			{},
			{ answers: [], cancelled: "false" },
			{ ...result, answers: [{ ...result.answers[0], answer: "foreign" }] },
			{ ...result, answers: [result.answers[0], result.answers[0]] },
		]) {
			await fixture.session.bindExtensions({
				humanInput: callbackHost({ questionnaire: async () => malformed as never }),
			});
			await assert.rejects(execute(params), { code: "InvalidHostInput" });
		}
		await fixture.session.bindExtensions({ humanInput: callbackHost() });
		assert.deepEqual((await execute(params)).details, { answers: [], cancelled: true });
		await fixture.session.bindExtensions({ humanInput: null });
		assert.deepEqual((await execute(params)).details, { answers: [], cancelled: true, error: "no_ui" });
	} finally {
		await fixture.close();
	}
});

// #3105: operational diagnostics belong to this session and omit arbitrary exception text.
test("SDK diagnostic sinks are session attributed and remain separate", async () => {
	const first: HostDiagnostic[] = [];
	const second: HostDiagnostic[] = [];
	const a = await hostSession({ onDiagnostic: (diagnostic) => first.push(diagnostic) });
	const b = await hostSession({ onDiagnostic: (diagnostic) => second.push(diagnostic) });
	try {
		await a.session.prompt("/diagnostic-test");
		assert.equal(first.length, 1);
		assert.equal(second.length, 0);
		assert.equal(first[0].sessionId, a.session.sessionId);
		assert.equal(first[0].level, "error");
		assert.ok(first[0].source);
		assert.ok(!first[0].message.includes("secret prompt token"));
		await b.session.prompt("/diagnostic-test");
		assert.equal(second[0].sessionId, b.session.sessionId);
	} finally {
		await a.close();
		await b.close();
	}
});

// #3105: callbacks see untouched multi-selection, custom text and omitted optional fields.
test("SDK questionnaire preserves multi-selection and empty custom answers", async () => {
	const params: QuestionParams = {
		questions: [
			{
				question: "Multiple?",
				header: "Multi",
				multiSelect: true,
				options: [
					{ label: "A", description: "" },
					{ label: "B", description: "" },
				],
			},
			{
				question: "Text?",
				header: "Text",
				options: [
					{ label: "A", description: "" },
					{ label: "B", description: "" },
				],
			},
		],
	};
	const result: QuestionnaireResult = {
		answers: [
			{ questionIndex: 1, question: "Text?", kind: "custom", answer: "" },
			{ questionIndex: 0, question: "Multiple?", kind: "multi", answer: null, selected: ["B", "A"], notes: "  \n" },
		],
		cancelled: false,
	};
	const fixture = await hostSession({
		humanInput: callbackHost({
			questionnaire: async (received) => {
				assert.deepEqual(received, params);
				return result;
			},
		}),
	});
	try {
		const tool = fixture.session.agent.state.tools.find((entry) => entry.name === "ask_user_question")!;
		assert.deepEqual((await tool.execute("question", params, new AbortController().signal)).details, result);
		const controller = new AbortController();
		controller.abort();
		await assert.rejects(tool.execute("cancelled", params, controller.signal), { code: "HumanInputCancelled" });
	} finally {
		await fixture.close();
	}
});

// #3105: a fully typed adapter is present before the first startup event, not after it.
test("SDK startup hooks can await human input without rendering", async () => {
	const cwd = mkdtempSync(join(tmpdir(), "atomic-host-start-"));
	const settingsManager = SettingsManager.inMemory();
	const calls: string[] = [];
	const loader = new DefaultResourceLoader({
		cwd,
		agentDir: join(cwd, "agent"),
		settingsManager,
		noExtensions: true,
		noContextFiles: true,
		extensionFactories: [
			(pi) => {
				pi.on("session_start", async (_event, context) => {
					assert.equal(context.hasUI, false);
					assert.equal(context.hasHumanInput, true);
					calls.push((await context.ui.input("Startup")) ?? "unanswered");
				});
			},
		],
	});
	try {
		await loader.reload();
		const { session } = await createAgentSession({
			cwd,
			agentDir: join(cwd, "agent"),
			settingsManager,
			resourceLoader: loader,
			sessionManager: SessionManager.inMemory(cwd),
			model: getModel("anthropic", "claude-sonnet-4-5")!,
			builtins: { workflows: false, subagents: false, mcp: false, intercom: false, "web-access": false },
			extensionBindings: { humanInput: callbackHost({ input: async () => "  initial " }) },
		});
		try {
			assert.deepEqual(calls, ["  initial "]);
			await session.bindExtensions({});
			assert.deepEqual(calls, ["  initial "]);
			await session.reload();
			assert.deepEqual(calls, ["  initial ", "  initial "]);
		} finally {
			await session.dispose();
		}
	} finally {
		rmSync(cwd, { recursive: true, force: true });
	}
});

// #3105: JavaScript hosts cannot advertise a partial or non-object human adapter.
test("SDK rejects adapters without every required method", async () => {
	for (const humanInput of [false, 0, "", {}, { confirm: async () => true }]) {
		await assert.rejects(hostSession({ humanInput: humanInput as never }), { code: "InvalidHostInput" });
	}
});

// #3105: array holes must not bypass the questionnaire's runtime schema.
test("SDK questionnaire rejects sparse answers and selections", async () => {
	const params: QuestionParams = {
		questions: [
			{
				question: "Choose?",
				header: "",
				multiSelect: true,
				options: [
					{ label: " A ", description: "" },
					{ label: "B", description: "" },
				],
			},
		],
	};
	for (const answers of [
		Array(1),
		[{ questionIndex: 0, question: "Choose?", kind: "multi", answer: null, selected: Array(1) }],
	]) {
		const fixture = await hostSession({
			humanInput: callbackHost({ questionnaire: async () => ({ cancelled: false, answers }) }),
		});
		try {
			const tool = fixture.session.agent.state.tools.find((entry) => entry.name === "ask_user_question")!;
			await assert.rejects(tool.execute("sparse", params, new AbortController().signal), {
				code: "InvalidHostInput",
			});
		} finally {
			await fixture.close();
		}
	}
});

// #3105: malformed accessor failures settle and release the owning request, not a detached promise.
test("SDK questionnaire settles throwing reply validation and releases the request", async () => {
	let identity!: HostInputOptions;
	let malformed = true;
	const valid: QuestionnaireResult = {
		cancelled: false,
		answers: [{ questionIndex: 0, question: "Choose?", kind: "option", answer: " A " }],
	};
	const fixture = await hostSession({
		humanInput: callbackHost({
			questionnaire: async (_params, options) => {
				identity = options;
				return malformed
					? {
							cancelled: false,
							get answers(): QuestionnaireResult["answers"] {
								throw new Error("broken reply accessor");
							},
						}
					: valid;
			},
		}),
	});
	try {
		const tool = fixture.session.agent.state.tools.find((entry) => entry.name === "ask_user_question")!;
		const params: QuestionParams = {
			questions: [
				{
					question: "Choose?",
					header: "",
					options: [
						{ label: " A ", description: "" },
						{ label: "B", description: "" },
					],
				},
			],
		};
		await assert.rejects(tool.execute("throwing", params, new AbortController().signal), {
			code: "InvalidHostInput",
		});
		await fixture.session.abort();
		assert.equal(identity.signal.aborted, false, "settled request is no longer pending during abort");
		malformed = false;
		assert.equal((await tool.execute("valid", params, new AbortController().signal)).details, valid);
	} finally {
		await fixture.close();
	}
}, 1000);

// #3105: child creation cannot discard the invoking SDK session's host or ceiling.
test("child session inherits callback and config without resurrecting disabled builtins", async () => {
	const requests: HostInputOptions[] = [];
	const fixture = await hostSession({
		humanInput: callbackHost({
			input: async (_title, _placeholder, options) => {
				requests.push(options);
				return "  child text  ";
			},
		}),
	});
	try {
		const options = fixture.contexts[0]!.getChildSessionOptions!({
			builtins: { intercom: true, workflows: true },
			sessionManager: SessionManager.inMemory(fixture.session.sessionManager.getCwd()),
		});
		const { session: child } = await createAgentSession(options);
		try {
			assert.equal(child.settingsManager, fixture.session.settingsManager);
			assert.equal(child.getActiveToolNames().includes("intercom"), false);
			assert.equal(child.getActiveToolNames().includes("workflow"), false);
			assert.equal(await child.extensionRunner.createContext().ui.input("raw"), "  child text  ");
			assert.equal(requests[0]!.sessionId, child.sessionManager.getSessionId());
			assert.notEqual(requests[0]!.sessionId, fixture.session.sessionManager.getSessionId());
		} finally {
			await child.dispose();
		}
	} finally {
		await fixture.close();
	}
});

// #3105: omitted selection, empty selection, and excluded tools are distinct child ceilings.
test.each([
	{ tools: [] },
	{ noTools: "all" as const },
	{ tools: ["read"], excludedTools: ["read"] },
	{ noTools: "builtin" as const },
])("child selections cannot widen parent %j", async (selection) => {
	const fixture = await hostSession();
	const base = fixture.contexts[0]!.getChildSessionOptions!({});
	const { session: parent } = await createAgentSession({
		...base,
		...selection,
		sessionManager: SessionManager.inMemory(base.cwd),
	});
	let child: AgentSession | undefined;
	try {
		const input = Object.freeze({ tools: Object.freeze(["read", "bash", "intercom"]) });
		const options = parent.extensionRunner.createContext().getChildSessionOptions!({
			tools: [...input.tools],
			sessionManager: SessionManager.inMemory(base.cwd),
		});
		child = (await createAgentSession(options)).session;
		assert.deepEqual(child.getActiveToolNames(), []);
		assert.deepEqual(input.tools, ["read", "bash", "intercom"]);
	} finally {
		await child?.dispose();
		await parent.dispose();
		await fixture.close();
	}
});

// #3105: siblings and replacement children retain their invoking owner's configuration.
test("child callbacks, diagnostics and relative cwd stay owner-local across rebinding and reload", async () => {
	const diagnostics: HostDiagnostic[][] = [[], []];
	const fixtures = await Promise.all(
		["left", "right"].map((label, index) =>
			hostSession({
				humanInput: callbackHost({ input: async () => label }),
				onDiagnostic: (diagnostic) => diagnostics[index]!.push(diagnostic),
			}),
		),
	);
	const children: AgentSession[] = [];
	try {
		for (let index = 0; index < fixtures.length; index++) {
			const fixture = fixtures[index]!;
			const cwd = join(fixture.session.sessionManager.getCwd(), "child");
			mkdirSync(cwd);
			const loader = new DefaultResourceLoader({
				cwd,
				agentDir: join(fixture.session.sessionManager.getCwd(), "agent"),
				settingsManager: fixture.session.settingsManager,
				resourceLoaderInheritanceSnapshot: fixture.loader.getInheritanceSnapshot(),
			});
			await loader.reload();
			const { session } = await createAgentSession(
				fixture.contexts[0]!.getChildSessionOptions!({
					cwd: "child",
					resourceLoader: loader,
					sessionManager: SessionManager.inMemory(cwd),
				}),
			);
			children.push(session);
			assert.equal(session.extensionRunner.createContext().cwd, cwd);
			assert.equal(session.settingsManager, fixture.session.settingsManager);
			assert.equal(await session.extensionRunner.createContext().ui.input("raw"), index === 0 ? "left" : "right");
			await session.prompt("/diagnostic-test");
			assert.equal(diagnostics[index]!.length, 1);
			assert.equal(diagnostics[index]![0]!.sessionId, session.sessionId);
		}
		await fixtures[0]!.session.bindExtensions({ humanInput: callbackHost({ input: async () => "replacement" }) });
		await fixtures[0]!.session.reload();
		const source = fixtures[0]!.session.extensionRunner.createContext();
		const { session: replacement } = await createAgentSession(
			source.getChildSessionOptions!({
				sessionManager: SessionManager.inMemory(fixtures[0]!.session.sessionManager.getCwd()),
			}),
		);
		children.push(replacement);
		assert.equal(await replacement.extensionRunner.createContext().ui.input("raw"), "replacement");
		assert.equal(replacement.getActiveToolNames().includes("intercom"), false);
		assert.equal(await children[1]!.extensionRunner.createContext().ui.input("raw"), "right");
		assert.equal(diagnostics[1]!.length, 1);
	} finally {
		for (const child of children) await child.dispose();
		for (const fixture of fixtures) await fixture.close();
	}
});

// #3105: the child manager supplies cwd unless an explicit parent-relative cwd wins.
test("child working directory honors manager before inherited default", async () => {
	const fixture = await hostSession();
	const parentCwd = fixture.session.sessionManager.getCwd();
	const managerCwd = join(parentCwd, "manager");
	mkdirSync(managerCwd);
	try {
		for (const cwd of [undefined, "", "."]) {
			const sessionManager = SessionManager.inMemory(managerCwd);
			const input = Object.freeze({ cwd, sessionManager });
			const { session } = await createAgentSession(fixture.contexts[0]!.getChildSessionOptions!(input));
			try {
				assert.equal(session.extensionRunner.createContext().cwd, cwd === undefined ? managerCwd : parentCwd);
				assert.equal(session.sessionManager, sessionManager);
				assert.equal(input.cwd, cwd);
			} finally {
				await session.dispose();
			}
		}
	} finally {
		await fixture.close();
	}
});

// #3105: optional undefined is omission, not a replacement model or host withdrawal.
test("undefined child configuration retains inherited values and callback identities", async () => {
	const diagnostics: HostDiagnostic[] = [];
	const host = callbackHost({ input: async () => "  inherited\n" });
	const fallbackModels = ["anthropic/claude-sonnet-4-5", "anthropic/claude-sonnet-4-5"];
	const customTools = [
		{
			name: "inherited_fixture",
			label: "Fixture",
			description: "Inherited custom tool",
			parameters: Type.Object({}),
			execute: async () => ({ content: [{ type: "text" as const, text: " raw " }], details: {} }),
		},
	];
	const fixture = await hostSession(
		{ humanInput: host, onDiagnostic: (entry) => diagnostics.push(entry) },
		{ fallbackModels, customTools, thinkingLevel: "high", isFallbackModelAllowed: () => false },
	);
	try {
		const resolve = fixture.contexts[0]!.getChildSessionOptions!;
		const baseline = resolve({});
		const input: CreateAgentSessionOptions = Object.freeze({
			agentDir: undefined,
			modelRuntime: undefined,
			settingsManager: undefined,
			model: undefined,
			thinkingLevel: undefined,
			fallbackModels: undefined,
			isFallbackModelAllowed: undefined,
			builtins: Object.freeze({ intercom: undefined }),
			tools: undefined,
			noTools: undefined,
			excludedTools: undefined,
			customTools: undefined,
			extensionBindings: Object.freeze({ humanInput: undefined, onDiagnostic: undefined }),
		});
		const options = resolve(input);
		const { session } = await createAgentSession({ ...options, resourceLoader: fixture.loader });
		try {
			assert.equal(session.model, fixture.session.model);
			assert.equal(session.settingsManager, fixture.session.settingsManager);
			assert.ok(session.getAllTools().some((tool) => tool.name === "inherited_fixture"));
			assert.equal(await session.extensionRunner.createContext().ui.input("raw"), "  inherited\n");
			await session.prompt("/diagnostic-test");
			assert.equal(diagnostics.length, 1);
			assert.equal(diagnostics[0]!.sessionId, session.sessionId);
			assert.deepEqual(options, baseline);
			for (const key of ["model", "modelRuntime", "settingsManager", "customTools", "fallbackModels"] as const) {
				assert.equal(options[key], baseline[key], key);
			}
			assert.equal(options.extensionBindings!.humanInput, host);
			assert.equal(input.extensionBindings!.humanInput, undefined);
		} finally {
			await session.dispose();
		}
	} finally {
		await fixture.close();
	}
});

// #3105: public disposal owns awaited shutdown and closes admission immediately.
test("public disposal awaits shutdown once and seals admission synchronously", async () => {
	const cwd = mkdtempSync(join(tmpdir(), "atomic-sdk-close-"));
	let release!: () => void;
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	let shutdowns = 0;
	const settingsManager = SettingsManager.inMemory();
	const resourceLoader = new DefaultResourceLoader({
		cwd,
		agentDir: join(cwd, "agent"),
		settingsManager,
		noExtensions: true,
		extensionFactories: [
			(pi) => {
				pi.on("session_shutdown", async () => {
					shutdowns++;
					await gate;
				});
			},
		],
	});
	await resourceLoader.reload();
	const { session } = await createAgentSession({
		cwd,
		agentDir: join(cwd, "agent"),
		resourceLoader,
		settingsManager,
		sessionManager: SessionManager.inMemory(cwd),
		builtins: { workflows: false, subagents: false, mcp: false, intercom: false, "web-access": false },
	});
	try {
		const closing = session.dispose();
		assert.ok(closing instanceof Promise);
		assert.equal(session.dispose(), closing);
		await assert.rejects(session.prompt("must not start"), { code: "SessionClosed" });
		await assert.rejects(session.bindExtensions({}), { code: "SessionClosed" });
		await assert.rejects(session.reload(), { code: "SessionClosed" });
		await assert.rejects(session.extensionRunner.createContext().ui.input("cannot ask"), { code: "SessionClosed" });
		let settled = false;
		void closing.then(() => {
			settled = true;
		});
		await new Promise((resolve) => setImmediate(resolve));
		assert.equal(settled, false);
		assert.equal(shutdowns, 1);
		release();
		await closing;
		assert.equal(session.dispose(), closing);
	} finally {
		release();
		await session.dispose();
		rmSync(cwd, { recursive: true, force: true });
	}
});

// #3105: one failed extension must not skip sibling cleanup or close borrowed settings.
test.each(["none", "diagnostic", "error"] as const)(
	"public disposal aggregates failures with %s observer failure and preserves a sibling",
	async (observerFailure) => {
		const cwd = mkdtempSync(join(tmpdir(), "atomic-sdk-close-failure-"));
		const settingsManager = SettingsManager.inMemory();
		const attempts: string[] = [];
		const resourceLoader = new DefaultResourceLoader({
			cwd,
			agentDir: join(cwd, "agent"),
			settingsManager,
			noExtensions: true,
			extensionFactories: [
				(pi) => {
					pi.on("session_shutdown", () => {
						attempts.push("first");
						throw new Error("first cleanup failed");
					});
				},
				(pi) => {
					pi.on("session_shutdown", () => {
						attempts.push("second");
						throw new Error("second cleanup failed");
					});
				},
			],
		});
		await resourceLoader.reload();
		const builtins = { workflows: false, subagents: false, mcp: false, intercom: false, "web-access": false };
		const { session } = await createAgentSession({
			cwd,
			agentDir: join(cwd, "agent"),
			resourceLoader,
			settingsManager,
			sessionManager: SessionManager.inMemory(cwd),
			builtins,
			extensionBindings: {
				onDiagnostic:
					observerFailure === "diagnostic"
						? () => {
								throw new Error("diagnostic observer failed");
							}
						: undefined,
				onError:
					observerFailure === "error"
						? () => {
								throw new Error("error observer failed");
							}
						: undefined,
			},
		});
		const { session: sibling } = await createAgentSession({
			cwd,
			agentDir: join(cwd, "agent"),
			settingsManager,
			sessionManager: SessionManager.inMemory(cwd),
			builtins,
		});
		const flushSettings = vi.spyOn(settingsManager, "flush").mockImplementationOnce(async () => {
			attempts.push("settings");
			throw new Error("settings flush failed");
		});
		const flushSession = vi.spyOn(session.sessionManager, "flush").mockImplementationOnce(() => {
			attempts.push("session");
		});
		try {
			const closing = session.dispose();
			await assert.rejects(closing, (error: Error & { code?: string }) => {
				assert.equal(error.code, "ShutdownFailed");
				assert.ok(error instanceof AggregateError);
				assert.equal(error.errors.length, observerFailure === "none" ? 3 : 5);
				return true;
			});
			assert.deepEqual(attempts, ["first", "second", "settings", "session"]);
			assert.equal(session.dispose(), closing);
			await assert.rejects(session.bindExtensions({}), { code: "SessionClosed" });
			await sibling.bindExtensions({
				humanInput: {
					confirm: async () => true,
					select: async () => undefined,
					input: async () => "alive",
					editor: async () => undefined,
					questionnaire: async () => ({ answers: [], cancelled: true }),
				},
			});
			assert.equal(await sibling.extensionRunner.createContext().ui.input("still live"), "alive");
			assert.equal(sibling.settingsManager, settingsManager);
		} finally {
			flushSettings.mockRestore();
			flushSession.mockRestore();
			await sibling.dispose();
			rmSync(cwd, { recursive: true, force: true });
		}
	},
);

// #3105: cancellation is not settlement; close must await the shell's drain.
test("public disposal aborts and drains active shell work and pending human input", async () => {
	const cwd = mkdtempSync(join(tmpdir(), "atomic-sdk-close-active-"));
	let inputSignal: AbortSignal | undefined;
	const { session } = await createAgentSession({
		cwd,
		agentDir: join(cwd, "agent"),
		sessionManager: SessionManager.inMemory(cwd),
		settingsManager: SettingsManager.inMemory(),
		builtins: { workflows: false, subagents: false, mcp: false, intercom: false, "web-access": false },
		extensionBindings: {
			humanInput: {
				confirm: async () => false,
				select: async () => undefined,
				input: (_title, _placeholder, options) => {
					inputSignal = options.signal;
					return new Promise(() => {});
				},
				editor: async () => undefined,
				questionnaire: async () => ({ answers: [], cancelled: true }),
			},
		},
	});
	let release!: () => void;
	const drain = new Promise<void>((resolve) => {
		release = resolve;
	});
	let aborted = false;
	const input = session.extensionRunner.createContext().ui.input("pending");
	const inputRejected = assert.rejects(input, { code: "HumanInputCancelled" });
	const shell = session.executeBash("controlled", undefined, {
		operations: {
			exec: async (_command, _cwd, options) => {
				await new Promise<void>((resolve) => {
					options.signal!.addEventListener(
						"abort",
						() => {
							aborted = true;
							resolve();
						},
						{ once: true },
					);
				});
				await drain;
				throw new Error("aborted");
			},
		},
	});
	try {
		const closing = session.dispose();
		let closed = false;
		void closing.then(() => {
			closed = true;
		});
		await new Promise((resolve) => setImmediate(resolve));
		assert.equal(aborted, true);
		assert.equal(inputSignal?.aborted, true);
		assert.equal(closed, false);
		await assert.rejects(session.executeBash("cannot start"), { code: "SessionClosed" });
		release();
		await shell;
		await inputRejected;
		await closing;
	} finally {
		release();
		await session.dispose();
		rmSync(cwd, { recursive: true, force: true });
	}
});

// #3105: queued admission is owned even before the child runner starts.
test("public disposal cancels a queued child without dispatching it", async () => {
	const cwd = mkdtempSync(join(tmpdir(), "atomic-sdk-close-queued-"));
	const { session } = await createAgentSession({
		cwd,
		agentDir: join(cwd, "agent"),
		sessionManager: SessionManager.inMemory(cwd),
		settingsManager: SettingsManager.inMemory(),
		builtins: { workflows: false, subagents: false, mcp: false, intercom: false, "web-access": false },
	});
	let dispatch!: () => Promise<void>;
	let started = 0;
	try {
		const host = session.getAgentTaskHost();
		const admitted = await host.startAgentTask(
			{ kind: "agent", agent: "fixture", task: "must remain queued" },
			"queued-close" as Parameters<typeof host.startAgentTask>[1],
			() => {
				started++;
				return {
					result: Promise.resolve({ kind: "completed", output: "unexpected" }),
					cleanup: Promise.resolve({ kind: "reaped" }),
				};
			},
			(run) => {
				dispatch = run;
			},
		);
		assert.ok(admitted.ok);
		await session.dispose();
		await dispatch();
		assert.equal(started, 0);
		const terminal = await host.close("session-close");
		assert.ok(terminal.ok, JSON.stringify(terminal));
		assert.equal(terminal.value.state, "closed");
		assert.equal(terminal.value.tasks.length, 1);
		const execution = terminal.value.tasks[0]!.execution;
		assert.equal(execution.kind, "settled");
		if (execution.kind === "settled") assert.equal(execution.result.kind, "cancelled");
	} finally {
		await session.dispose();
		rmSync(cwd, { recursive: true, force: true });
	}
});
