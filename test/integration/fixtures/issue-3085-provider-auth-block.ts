/**
 * Isolated process-restart fixture for issue #3085.
 *
 * The parent integration test drives a fabricated rate-limit + expired-OAuth
 * block, persists mock DBOS state to disk, then spawns this file as a child.
 * The child hydrates an empty in-memory mirror from that file, asserts the
 * restored blocked/resumable metadata, resumes after simulated provider
 * recovery, and proves the completed prefix is not executed again.
 */
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { type AssistantMessage, createAssistantMessageEventStream } from "@bastani/pi-ai/compat";
import { AuthStorage } from "../../../packages/coding-agent/src/core/auth-storage.js";
import { ModelRuntime } from "../../../packages/coding-agent/src/core/model-runtime.js";
import { createAgentSession } from "../../../packages/coding-agent/src/core/sdk.js";
import { SessionManager } from "../../../packages/coding-agent/src/core/session-manager.js";
import { SettingsManager } from "../../../packages/coding-agent/src/core/settings-manager.js";
import { createTestResourceLoader } from "../../../packages/coding-agent/test/utilities.js";
import { workflow } from "../../../packages/workflows/src/authoring/workflow.js";
import { DbosDurableBackend } from "../../../packages/workflows/src/durable/dbos-backend.js";
import { setDurableBackend } from "../../../packages/workflows/src/durable/factory.js";
import { createExtensionRuntime } from "../../../packages/workflows/src/extension/runtime.js";
import { createJobTracker } from "../../../packages/workflows/src/runs/background/job-tracker.js";
import type {
	StageSessionCreateOptions,
	StageSessionRuntime,
} from "../../../packages/workflows/src/runs/foreground/stage-runner-types.js";
import { effectiveRunStatus } from "../../../packages/workflows/src/shared/returned-run-status.js";
import { createStore } from "../../../packages/workflows/src/shared/store.js";
import { createRegistry } from "../../../packages/workflows/src/workflows/registry.js";
import { sleep } from "../../helpers/runtime.js";
import {
	createMockSdk,
	restoreMockSdkState,
	type SerializedMockDbosState,
} from "../../unit/durable-dbos-backend-helpers.js";

export const ISSUE_3085_WORKFLOW_NAME = "provider-auth-block-3085";
export const ISSUE_3085_PERSIST_FILE = "persist.json";
export const ISSUE_3085_PREFIX_FILE = "prefix.txt";
export const ISSUE_3085_RESULT_FILE = "resume-result.json";

export type Issue3085PersistedState = {
	readonly runId: string;
	readonly sdk: SerializedMockDbosState;
};

export type Issue3085ResumeResult = {
	readonly status: string;
	readonly prefix: number;
	readonly failureKind?: string;
	readonly failureCode?: string;
	readonly failureDisposition?: string;
	readonly failureRecoverability?: string;
	readonly resumable?: boolean;
};

const spec = {
	id: "m",
	name: "m",
	reasoning: false,
	input: ["text"] as ("text" | "image")[],
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
	contextWindow: 100_000,
	maxTokens: 1000,
};

function message(
	model: { api: AssistantMessage["api"]; provider: string; id: string },
	extra: {
		content?: AssistantMessage["content"];
		stopReason?: AssistantMessage["stopReason"];
		errorMessage?: string;
	} = {},
): AssistantMessage {
	return {
		role: "assistant",
		content: extra.content ?? [{ type: "text", text: "ok" }],
		api: model.api,
		provider: model.provider,
		model: model.id,
		usage: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 0,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
		stopReason: extra.stopReason ?? "stop",
		timestamp: Date.now(),
		...(extra.errorMessage === undefined ? {} : { errorMessage: extra.errorMessage }),
	};
}

function response(
	model: { api: AssistantMessage["api"]; provider: string; id: string },
	extra: {
		content?: AssistantMessage["content"];
		stopReason?: AssistantMessage["stopReason"];
		errorMessage?: string;
	} = {},
) {
	const stream = createAssistantMessageEventStream();
	const msg = message(model, extra);
	stream.push({ type: "start", partial: msg });
	if (msg.stopReason === "error") {
		stream.push({ type: "error", reason: "error", error: msg });
	} else {
		stream.push({ type: "done", reason: "stop", message: msg });
	}
	stream.end(msg);
	return stream;
}

function requestedProvider(model: unknown): string {
	if (typeof model === "string") return model.split("/")[0] ?? "primary";
	if (model !== null && typeof model === "object" && "provider" in model && typeof model.provider === "string") {
		return model.provider;
	}
	return "primary";
}

export function prefixPath(dir: string): string {
	return join(dir, ISSUE_3085_PREFIX_FILE);
}

export function persistPath(dir: string): string {
	return join(dir, ISSUE_3085_PERSIST_FILE);
}

export function resultPath(dir: string): string {
	return join(dir, ISSUE_3085_RESULT_FILE);
}

export function readPrefix(dir: string): number {
	const path = prefixPath(dir);
	return existsSync(path) ? Number(readFileSync(path, "utf8")) : 0;
}

export function bumpPrefix(dir: string): number {
	const next = readPrefix(dir) + 1;
	writeFileSync(prefixPath(dir), String(next));
	return next;
}

export function createIssue3085Definition(dir: string) {
	return workflow({
		name: ISSUE_3085_WORKFLOW_NAME,
		description: "isolated provider recovery",
		inputs: {},
		outputs: {},
		run: async (ctx) => {
			await ctx.tool("prefix", {}, async () => bumpPrefix(dir));
			await ctx.stage("provider", { model: "primary/m", fallbackModels: ["probe/m"] }).prompt("go");
			return {};
		},
	});
}

export async function createIssue3085StageSession(input: {
	readonly dir: string;
	readonly model: StageSessionCreateOptions["model"];
	readonly fallbackModels?: StageSessionCreateOptions["fallbackModels"];
	readonly recovered: boolean;
}): Promise<StageSessionRuntime> {
	const credentials = AuthStorage.inMemory({
		probe: { type: "oauth", access: "fabricated", refresh: "fabricated", expires: 1 },
		primary: { type: "api_key", key: "fabricated" },
	});
	const modelRuntime = await ModelRuntime.create({
		credentials,
		modelsPath: null,
		refreshOnCreate: false,
	});
	modelRuntime.registerProvider("probe", {
		api: "openai-completions",
		baseUrl: "https://example.invalid",
		oauth: {
			name: "probe",
			login: async () => {
				throw new Error("not used");
			},
			refreshToken: async (credential) => {
				if (!input.recovered) return new Promise(() => {});
				return { ...credential, expires: Number.MAX_SAFE_INTEGER };
			},
			getApiKey: (credential) => credential.access,
		},
		models: [spec],
		streamSimple: (model) => response(model),
	});
	modelRuntime.registerProvider("primary", {
		api: "openai-completions",
		baseUrl: "https://example.invalid",
		apiKey: "fabricated",
		models: [spec],
		streamSimple: (model) =>
			response(model, {
				content: [],
				stopReason: "error",
				errorMessage: "429 rate limit exceeded",
			}),
	});
	const sessionDir = join(input.dir, `stage-${Date.now()}-${Math.random().toString(16).slice(2)}`);
	mkdirSync(sessionDir, { recursive: true });
	const { session } = await createAgentSession({
		cwd: sessionDir,
		agentDir: sessionDir,
		modelRuntime,
		model: modelRuntime.getModel(requestedProvider(input.model), "m")!,
		fallbackModels: input.fallbackModels,
		settingsManager: SettingsManager.inMemory({
			retry: { enabled: true, maxRetries: 3, baseDelayMs: 2000, maxAgentDelayMs: 60_000 },
			compaction: { enabled: false },
		}),
		sessionManager: SessionManager.create(sessionDir, join(sessionDir, "sessions")),
		resourceLoader: createTestResourceLoader(),
	});
	return session as unknown as StageSessionRuntime;
}

export async function resumeIssue3085FromPersistedState(dir: string): Promise<Issue3085ResumeResult> {
	const persisted = JSON.parse(readFileSync(persistPath(dir), "utf8")) as Issue3085PersistedState;
	const sdk = createMockSdk();
	restoreMockSdkState(sdk, persisted.sdk);
	const backend = new DbosDurableBackend(sdk, { executorId: "3085-process-restart" });
	setDurableBackend(backend);
	try {
		await backend.hydrateWorkflow(persisted.runId);
		const hydrated = backend.getWorkflow(persisted.runId);
		assert.ok(hydrated, "blocked workflow must remain discoverable after an isolated process restart");
		assert.equal(hydrated.status, "blocked");
		assert.equal(hydrated.resumable, true);
		// Blocked durable records persist status and resumability. Failure kind
		// lives on the live store and is asserted in the parent before restart.
		assert.equal(readPrefix(dir), 1, "prefix must already be persisted before resume");

		const store = createStore();
		const jobs = createJobTracker();
		const definition = createIssue3085Definition(dir);
		const runtime = createExtensionRuntime({
			store,
			jobs,
			cwd: dir,
			registry: createRegistry([definition]),
			adapters: {
				agentSession: {
					create: async (options) =>
						createIssue3085StageSession({
							dir,
							model: options.model,
							fallbackModels: options.fallbackModels,
							recovered: true,
						}),
				},
			},
		});
		const resumed = await runtime.resumeDurableWorkflow(persisted.runId);
		assert.equal(resumed.ok, true, resumed.ok ? undefined : resumed.message);
		assert.ok(resumed.ok && resumed.runId);
		const runId = resumed.runId;
		const deadline = Date.now() + 20_000;
		while (Date.now() < deadline) {
			const snapshot = store.runs().find((run) => run.id === runId);
			if (snapshot !== undefined && effectiveRunStatus(snapshot) === "completed") break;
			await sleep(25);
		}
		const continuation = store.runs().find((run) => run.id === runId);
		assert.ok(continuation, "resumed run must appear in the fresh process store");
		assert.equal(effectiveRunStatus(continuation), "completed", JSON.stringify(continuation));
		assert.equal(readPrefix(dir), 1, "completed prefix must not execute twice");
		const result: Issue3085ResumeResult = {
			status: effectiveRunStatus(continuation),
			prefix: readPrefix(dir),
			failureKind: hydrated.failureKind,
			failureCode: hydrated.failureCode,
			failureDisposition: hydrated.failureDisposition,
			failureRecoverability: hydrated.failureRecoverability,
			resumable: hydrated.resumable,
		};
		writeFileSync(resultPath(dir), `${JSON.stringify(result)}\n`);
		return result;
	} finally {
		setDurableBackend(undefined);
	}
}

const invokedDirectly = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1];
if (
	(invokedDirectly || process.argv[1]?.includes("issue-3085-provider-auth-block") === true) &&
	process.argv[2] === "resume"
) {
	const dir = process.argv[3];
	assert.ok(dir, "resume child requires the persisted-state directory");
	void resumeIssue3085FromPersistedState(dir).catch((error: unknown) => {
		console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
		process.exitCode = 1;
	});
}
