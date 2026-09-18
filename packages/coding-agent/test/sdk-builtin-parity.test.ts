import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
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
			session.dispose();
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
			session.dispose();
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
			session.dispose();
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
			session.dispose();
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
			session.dispose();
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
				session.dispose();
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
			session.dispose();
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
			session.dispose();
		}
	} finally {
		rmSync(cwd, { recursive: true, force: true });
	}
});

// #3105: package suppression removes resources as well as tools across generations.
test("disabled builtins stay absent with custom discovery and reload", async () => {
	const cwd = mkdtempSync(join(tmpdir(), "atomic-sdk-disabled-"));
	const settingsManager = SettingsManager.inMemory();
	const loader = new DefaultResourceLoader({
		cwd,
		agentDir: join(cwd, "agent"),
		settingsManager,
		builtinPackagePaths: getBuiltinPackagePaths(),
		noContextFiles: true,
	});
	await loader.reload();
	const original = [...loader.getExtensions().extensions];
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
					await session.reload();
				}
			}
		} finally {
			session.dispose();
		}
	} finally {
		rmSync(cwd, { recursive: true, force: true });
	}
});

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
			session.dispose();
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
			session.dispose();
		}
	} finally {
		rmSync(cwd, { recursive: true, force: true });
	}
});
