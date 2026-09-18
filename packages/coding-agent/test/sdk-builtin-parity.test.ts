import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getModel } from "@bastani/pi-ai/compat";
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
import { createAgentSession } from "../src/core/sdk.ts";
import { SessionManager } from "../src/core/session-manager.ts";
import { SettingsManager } from "../src/core/settings-manager.ts";

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
			assert.ok(session.getAllTools().some((tool) => tool.name === "workflow"));
			assert.ok(session.systemPrompt.startsWith("Caller-owned prompt"));
			assert.deepEqual(loader.getExtensions().extensions, originalExtensions);
			await Promise.all([session.bindExtensions({}), session.bindExtensions({})]);
			assert.equal(starts, 1);
			await session.reload();
			await session.bindExtensions({});
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
