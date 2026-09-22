/**
 * An admitted subagent child must register with the Intercom broker as soon as
 * its session starts. Before this, a child only connected lazily on its own
 * first Intercom call, so a working child that never touched Intercom was
 * invisible to `intercom list` and unreachable by `send`/`ask` from its
 * launching stage or chat, even though both share the child's group.
 */
import assert from "node:assert/strict";
import type { ExtensionAPI, ExtensionContext, ToolDefinition } from "@bastani/atomic";
import { Type } from "typebox";
import { afterEach, beforeEach, describe, test, vi } from "vitest";
import { createEventBus } from "../../packages/coding-agent/src/core/event-bus.js";
import { runGenericHandlers } from "../../packages/coding-agent/src/core/extensions/runner-events.js";
import type { Extension, ExtensionError } from "../../packages/coding-agent/src/core/extensions/types.js";
import { IntercomClient } from "../../packages/intercom/broker/client.js";
import { spawnBrokerIfNeeded } from "../../packages/intercom/broker/spawn.js";
import intercom from "../../packages/intercom/index.js";
import intercomHeavy from "../../packages/intercom/index-heavy.js";
import { IntercomClientDisconnectedError } from "../../packages/intercom/recoverable-disconnect.js";

type HeavyModule = { default: (pi: ExtensionAPI) => void | Promise<void> };
type ImportResult = { error: unknown } | { module: HeavyModule };
type ExtensionEventHandler = (event: unknown, ctx: unknown) => Promise<unknown> | unknown;
type ConsoleErrorCall = [message?: unknown, ...optionalParams: unknown[]];

vi.mock("../../packages/intercom/broker/spawn.js", () => ({ spawnBrokerIfNeeded: vi.fn() }));

const EXTENSION_PATH = "<intercom>";
const originalConsoleError = console.error;
let consoleErrorCalls: ConsoleErrorCall[] = [];

beforeEach(() => {
	consoleErrorCalls = [];
	console.error = (...args: ConsoleErrorCall) => {
		consoleErrorCalls.push(args);
	};
});

afterEach(() => {
	console.error = originalConsoleError;
});

function admittedChildContext(): ExtensionContext {
	return {
		cwd: process.cwd(),
		hasUI: false,
		subagentPolicy: {
			managementActions: "restricted",
			fanoutAuthorized: false,
			inheritProjectContext: true,
			inheritSkills: true,
			intercomGroup: "workflow:run-1",
			intercom: {
				orchestratorTarget: "subagent-chat-parent",
				runId: "run-1",
				agent: "worker",
				index: 0,
				sessionName: "subagent-worker-run-1-1",
			},
		},
	} as never;
}

function plainSessionContext(): ExtensionContext {
	return { cwd: process.cwd(), hasUI: true } as never;
}

function heavyModule(onSessionStart: (ctx: unknown) => void): HeavyModule {
	return {
		default(heavyPi) {
			heavyPi.on("session_start", async (_event, ctx) => {
				onSessionStart(ctx);
			});
			heavyPi.registerTool({
				name: "intercom",
				label: "Intercom",
				description: "test intercom",
				parameters: Type.Object({}),
				async execute() {
					return { content: [{ type: "text", text: "connected" }], details: {} };
				},
			});
		},
	};
}

function fixture(importResults: ImportResult[]) {
	const handlers = new Map<string, ExtensionEventHandler[]>();
	const tools = new Map<string, ToolDefinition>();
	let imports = 0;
	const pi = {
		on(event: string, handler: ExtensionEventHandler) {
			handlers.set(event, [...(handlers.get(event) ?? []), handler]);
		},
		registerTool(tool: ToolDefinition) {
			tools.set(tool.name, tool);
		},
		registerCommand() {},
		registerShortcut() {},
		setSessionName() {},
		getActiveTools: () => [],
		setActiveTools() {},
		events: { on() {}, emit() {} },
	};
	intercom(pi as never, {
		async importHeavy() {
			const result = importResults[imports++];
			assert.ok(result, "each heavy initialization attempt needs a fixture result");
			if ("error" in result) throw result.error;
			return result.module;
		},
	});
	function hostExtension(): Extension {
		const hostHandlers = new Map<string, Array<(...args: unknown[]) => Promise<unknown>>>();
		for (const [event, registered] of handlers) {
			hostHandlers.set(
				event,
				registered.map((handler) => async (...args: unknown[]) => {
					const [extensionEvent, ctx] = args;
					return await handler(extensionEvent, ctx);
				}),
			);
		}
		return {
			path: EXTENSION_PATH,
			resolvedPath: EXTENSION_PATH,
			sourceInfo: { source: "builtin", scope: "temporary", origin: "top-level" },
			handlers: hostHandlers,
			tools: new Map(),
			messageRenderers: new Map(),
			entryRenderers: new Map(),
			commands: new Map(),
			flags: new Map(),
			shortcuts: new Map(),
		} as never;
	}
	return {
		get imports() {
			return imports;
		},
		async emitSessionStart(ctx: ExtensionContext): Promise<ExtensionError[]> {
			const reported: ExtensionError[] = [];
			const event = { type: "session_start", reason: "startup" };
			await runGenericHandlers([hostExtension()], ctx, event as never, (error) => reported.push(error));
			return reported;
		},
		executeIntercomTool(ctx: ExtensionContext) {
			const tool = tools.get("intercom");
			assert.ok(tool, "intercom tool should be registered");
			return tool.execute("tool-call", { action: "list" }, new AbortController().signal, undefined, ctx as never);
		},
	};
}

describe("Intercom admitted subagent child warm-up", () => {
	test("connects an admitted child at session_start so its supervisor can list and steer it", async () => {
		const replayed: unknown[] = [];
		const current = fixture([{ module: heavyModule((ctx) => replayed.push(ctx)) }]);
		const ctx = admittedChildContext();

		const reported = await current.emitSessionStart(ctx);

		assert.deepEqual(reported, []);
		assert.equal(current.imports, 1, "the admitted child must initialize Intercom without waiting for a tool call");
		assert.deepEqual(replayed, [ctx]);
	});

	test("keeps a plain session lazy", async () => {
		const current = fixture([{ module: heavyModule(() => {}) }]);

		await current.emitSessionStart(plainSessionContext());

		assert.equal(current.imports, 0);
	});

	test("keeps a recoverable warm-up disconnect out of the child's launch and reconnects on the next call", async () => {
		const replayed: unknown[] = [];
		const current = fixture([
			{ error: new IntercomClientDisconnectedError() },
			{ module: heavyModule((ctx) => replayed.push(ctx)) },
		]);
		const ctx = admittedChildContext();

		const reported = await current.emitSessionStart(ctx);
		const result = await current.executeIntercomTool(ctx);

		assert.deepEqual(reported, []);
		assert.deepEqual(consoleErrorCalls, []);
		assert.equal(current.imports, 2);
		assert.deepEqual(replayed, [ctx]);
		assert.deepEqual(result.content, [{ type: "text", text: "connected" }]);
	});

	test("still reports a non-recoverable warm-up failure to the host", async () => {
		const importError = new Error("Cannot import Intercom heavy module");
		const current = fixture([{ error: importError }]);

		const reported = await current.emitSessionStart(admittedChildContext());

		assert.equal(reported.length, 1);
		assert.equal(reported[0]?.event, "session_start");
		assert.equal(reported[0]?.error, importError.message);
	});
});

describe("Intercom heavy runtime admitted child registration", () => {
	afterEach(() => vi.restoreAllMocks());

	function heavyFixture(ctxOverrides: Record<string, unknown>) {
		vi.mocked(spawnBrokerIfNeeded).mockResolvedValue(undefined as never);
		const registrations: Array<Parameters<IntercomClient["connect"]>[0]> = [];
		const groups: Array<string | undefined> = [];
		vi.spyOn(IntercomClient.prototype, "connect").mockImplementation(async (registration, ...rest) => {
			registrations.push(structuredClone(registration));
			groups.push(rest[3]);
		});
		vi.spyOn(IntercomClient.prototype, "registerLiveWorkflowStageRoute").mockResolvedValue();
		vi.spyOn(IntercomClient.prototype, "disconnect").mockResolvedValue();
		const handlers = new Map<string, Array<(event: never, ctx: ExtensionContext) => void | Promise<void>>>();
		let sessionName: string | undefined;
		const pi = {
			on(name: string, handler: (event: never, ctx: ExtensionContext) => void | Promise<void>) {
				handlers.set(name, [...(handlers.get(name) ?? []), handler]);
			},
			registerTool() {},
			registerCommand() {},
			registerShortcut() {},
			registerMessageRenderer() {},
			appendEntry() {},
			getSessionName: () => sessionName,
			setSessionName(value: string) {
				sessionName = value;
			},
			events: createEventBus(),
		};
		intercomHeavy(pi as never);
		const ctx = {
			hasUI: false,
			cwd: process.cwd(),
			isIdle: () => true,
			ui: { notify() {} },
			sessionManager: { getSessionId: () => "child-session", getBranch: () => [] },
			...ctxOverrides,
		} as unknown as ExtensionContext;
		const fire = async (name: string) => {
			for (const handler of handlers.get(name) ?? []) await handler({} as never, ctx);
		};
		return { registrations, groups, fire };
	}

	test("registers an admitted child with its inherited group on session_start", async () => {
		const current = heavyFixture({
			subagentPolicy: {
				intercomGroup: "workflow:run-1",
				intercom: {
					orchestratorTarget: "subagent-chat-parent",
					runId: "run-1",
					agent: "worker",
					index: 0,
					sessionName: "subagent-worker-run-1-1",
				},
			},
		});
		try {
			await current.fire("session_start");
			assert.equal(current.registrations.length, 1);
			assert.equal(current.registrations[0]?.group, "workflow:run-1");
			assert.deepEqual(current.groups, ["workflow:run-1"]);
		} finally {
			await current.fire("session_shutdown");
		}
	});

	test("leaves a session without a typed child identity lazy", async () => {
		const current = heavyFixture({});
		try {
			await current.fire("session_start");
			assert.equal(current.registrations.length, 0);
		} finally {
			await current.fire("session_shutdown");
		}
	});
});

describe("Intercom admitted child broker-connect recovery through the real composition", () => {
	afterEach(() => vi.restoreAllMocks());

	test("keeps a recoverable startup connect failure out of the launch and reconnects on the next call", async () => {
		vi.mocked(spawnBrokerIfNeeded).mockResolvedValue(undefined as never);
		const connectAttempts: Array<Parameters<IntercomClient["connect"]>[0]> = [];
		vi.spyOn(IntercomClient.prototype, "connect").mockImplementation(async (registration) => {
			connectAttempts.push(structuredClone(registration));
			if (connectAttempts.length === 1) throw new IntercomClientDisconnectedError();
		});
		vi.spyOn(IntercomClient.prototype, "isConnected").mockImplementation(function (this: IntercomClient) {
			return connectAttempts.length >= 2;
		});
		vi.spyOn(IntercomClient.prototype, "listSessions").mockResolvedValue([]);
		vi.spyOn(IntercomClient.prototype, "disconnect").mockResolvedValue();
		const handlers = new Map<string, ExtensionEventHandler[]>();
		const tools = new Map<string, ToolDefinition>();
		let sessionName: string | undefined;
		const pi = {
			on(event: string, handler: ExtensionEventHandler) {
				handlers.set(event, [...(handlers.get(event) ?? []), handler]);
			},
			registerTool(tool: ToolDefinition) {
				tools.set(tool.name, tool);
			},
			registerCommand() {},
			registerShortcut() {},
			registerMessageRenderer() {},
			appendEntry() {},
			getSessionName: () => sessionName,
			setSessionName(value: string) {
				sessionName = value;
			},
			getActiveTools: () => [],
			setActiveTools() {},
			events: createEventBus(),
		};
		intercom(pi as never);
		const ctx = {
			...admittedChildContext(),
			isIdle: () => true,
			ui: { notify() {} },
			sessionManager: { getSessionId: () => "child-session", getBranch: () => [] },
		} as unknown as ExtensionContext;
		const hostHandlers = new Map<string, Array<(...args: unknown[]) => Promise<unknown>>>();
		for (const [event, registered] of handlers) {
			hostHandlers.set(
				event,
				registered.map(
					(handler) =>
						async (...args: unknown[]) =>
							await handler(args[0], args[1]),
				),
			);
		}
		const extension = {
			path: EXTENSION_PATH,
			resolvedPath: EXTENSION_PATH,
			sourceInfo: { source: "builtin", scope: "temporary", origin: "top-level" },
			handlers: hostHandlers,
			tools: new Map(),
			messageRenderers: new Map(),
			entryRenderers: new Map(),
			commands: new Map(),
			flags: new Map(),
			shortcuts: new Map(),
		} as never as Extension;
		const reported: ExtensionError[] = [];
		try {
			await runGenericHandlers([extension], ctx, { type: "session_start", reason: "startup" } as never, (error) =>
				reported.push(error),
			);
			assert.deepEqual(reported, []);
			assert.deepEqual(consoleErrorCalls, []);
			assert.equal(connectAttempts.length, 1, "startup must attempt the broker connection once");

			const tool = tools.get("intercom");
			assert.ok(tool, "intercom tool should be registered");
			const result = await tool.execute(
				"tool-call",
				{ action: "status" },
				new AbortController().signal,
				undefined,
				ctx as never,
			);

			assert.equal(connectAttempts.length, 2, "the next Intercom call must reconnect");
			assert.equal(connectAttempts[1]?.group, "workflow:run-1");
			const text = result.content.map((part) => ("text" in part ? part.text : "")).join("\n");
			assert.match(text, /Connected: Yes/);
		} finally {
			await runGenericHandlers([extension], ctx, { type: "session_shutdown", reason: "quit" } as never, (error) =>
				reported.push(error),
			);
		}
	});
});
