import assert from "node:assert/strict";
import { createServer, type Socket } from "node:net";
import { join } from "node:path";
import { workflow } from "../../packages/workflows/src/authoring/workflow.js";
import { configureDbosDurableBackend, DbosDurableBackend } from "../../packages/workflows/src/durable/dbos-backend.js";
import {
	hydrateBinaryLibraryLinks,
	loadEmbeddedPostgresBinaries,
} from "../../packages/workflows/src/durable/dbos-embedded-postgres.js";
import { shutdownDbos } from "../../packages/workflows/src/durable/dbos-lifecycle.js";
import { getDurableBackend, initializeDurableBackend } from "../../packages/workflows/src/durable/factory.js";
import { runLocalCommand } from "../../packages/workflows/src/durable/local-command.js";
import { createExtensionRuntime } from "../../packages/workflows/src/extension/runtime.js";
import { makeExecuteWorkflowTool } from "../../packages/workflows/src/extension/workflow-tool.js";
import {
	workflowPauseAction,
	workflowQuitAction,
	workflowResumeAction,
} from "../../packages/workflows/src/extension/workflow-tool-control.js";
import { jobTracker } from "../../packages/workflows/src/runs/background/job-tracker.js";
import { runDetached } from "../../packages/workflows/src/runs/background/runner.js";
import { store } from "../../packages/workflows/src/shared/store.js";
import { INTERACTIVE_WORKFLOW_POLICY } from "../../packages/workflows/src/shared/types.js";
import { readText, sleep } from "../helpers/runtime.js";

const [home, phase, action, barrier] = process.argv.slice(2);
assert.ok(home && (phase === "admission" || phase === "checkpoint"));
assert.ok(action === "pause" || action === "quit" || action === "observe");
assert.notEqual(
	process.getuid?.(),
	0,
	"Run this real fault fixture as an unprivileged user; never use the shared root cluster.",
);
const data = join(home, "owned-data");
const binaries = await loadEmbeddedPostgresBinaries();
hydrateBinaryLibraryLinks(binaries.pg_ctl);
async function command(args: string[], starting = false) {
	const result = await runLocalCommand(
		binaries.pg_ctl,
		args,
		starting ? { completion: "successful-exit" } : undefined,
	);
	assert.equal(result.exitCode, 0, result.stderr + result.stdout);
}
let started = false;
async function stop() {
	if (!started) return;
	await command(["-D", data, "-m", "fast", "-w", "-t", "10", "stop"]);
	started = false;
}
async function availablePort() {
	const server = createServer();
	await new Promise<void>((resolve, reject) => {
		server.once("error", reject);
		server.listen(0, "127.0.0.1", resolve);
	});
	const address = server.address();
	assert.ok(address && typeof address !== "string");
	await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
	return address.port;
}
let port = await availablePort();
let starts = 0;
async function start(retryBind = false) {
	for (let attempt = 0; attempt < 3; attempt++) {
		const log = join(home!, `postgres-${++starts}.log`);
		// Intent precedes spawn so partial startup is still subject to owned cleanup.
		started = true;
		try {
			await command(["-D", data, "-l", log, "-o", `-h 127.0.0.1 -p ${port}`, "-w", "-t", "10", "start"], true);
			return;
		} catch (error) {
			const status = await runLocalCommand(binaries.pg_ctl, ["-D", data, "status"]);
			if (status.exitCode === 3) started = false;
			const output = await readText(log);
			const collision =
				/could not bind IPv4 address.*(?:Address already in use|Only one usage of each socket address)/.test(
					output,
				) && /FATAL:\s+could not create any TCP\/IP sockets/.test(output);
			if (!retryBind || !collision || started || attempt === 2) throw error;
			port = await availablePort();
		}
	}
}
async function until(predicate: () => boolean, label: string) {
	const deadline = Date.now() + 20_000;
	while (!predicate()) {
		assert.ok(Date.now() < deadline, label);
		await sleep(20);
	}
}
// A TCP accept proves the real DBOS admission has left the deferred startup turn.
// This owned listener deliberately withholds the PostgreSQL handshake until control returns.
const sockets = new Set<Socket>();
let connected = false;
const sink = createServer((socket) => {
	sockets.add(socket);
	socket.once("close", () => sockets.delete(socket));
	connected = true;
});
async function closeSink() {
	if (!sink.listening) return;
	const closed = new Promise<void>((resolve, reject) =>
		sink.close((error) => (error ? reject(error) : resolve())),
	);
	for (const socket of sockets) socket.destroy();
	await closed;
}
// Cleanup runs before the outer process timeout, including when a DBOS await stalls.
const FIXTURE_DEADLINE_MS = 95_000;
const interrupted = () => {
	void closeSink().then(stop).finally(() => process.exit(2));
};
const watchdog = setTimeout(interrupted, FIXTURE_DEADLINE_MS);
process.once("SIGTERM", interrupted);
process.once("SIGINT", interrupted);
let failure: Error | undefined;
try {
	const init = await runLocalCommand(binaries.initdb, [
		"-D",
		data,
		"-U",
		"postgres",
		"--auth=trust",
		"--no-locale",
		"--encoding=UTF8",
	]);
	assert.equal(init.exitCode, 0, init.stderr + init.stdout);
	await start(true);
	process.env.DBOS_SYSTEM_DATABASE_URL = `postgresql://postgres@127.0.0.1:${port}/outage_dbos?connect_timeout=2&sslmode=disable`;
	const backend = await initializeDurableBackend((message) => {
		throw new Error(message);
	});
	assert.ok(backend instanceof DbosDurableBackend);
	assert.equal(getDurableBackend().persistent, true);
	let completedCalls = 0;
	let frontierCalls = 0;
	let releaseFrontier: (() => void) | undefined;
	const definition = workflow({
		name: "real-postgres-outage",
		description: "Owned PostgreSQL fault regression #3072/#3074",
		inputs: {},
		outputs: {},
		run: async (ctx) => {
			await ctx.tool("completed", {}, async () => {
				completedCalls++;
				return "persisted";
			});
			await ctx.tool("frontier", {}, async ({ signal }) => {
				frontierCalls++;
				if (phase === "checkpoint" && frontierCalls === 1)
					await new Promise<void>((resolve, reject) => {
						releaseFrontier = resolve;
						signal.addEventListener("abort", () => reject(signal.reason), { once: true });
					});
				return "done";
			});
			return {};
		},
	});
	const runtime = createExtensionRuntime({ definitions: [definition], store });
	if (phase === "admission") await stop();
	if (barrier === "connected") {
		assert.equal(phase, "admission");
		await new Promise<void>((resolve, reject) => {
			sink.once("error", reject);
			sink.listen(port, "127.0.0.1", resolve);
		});
	}
	const { runId } = runDetached(definition, {}, { store });
	const job = jobTracker.get(runId);
	assert.ok(job);
	if (phase === "checkpoint") {
		await until(() => frontierCalls === 1, "first checkpoint did not complete");
		await backend.flush(runId);
		assert.ok(
			backend
				.listCheckpoints(runId)
				.some((checkpoint) => checkpoint.kind === "tool" && checkpoint.name === "completed"),
		);
		await stop();
		// The next author callback returns while PostgreSQL is down, forcing a real checkpoint write failure.
		releaseFrontier?.();
		await new Promise<void>((resolve) => setImmediate(resolve));
	} else {
		assert.equal(completedCalls, 0);
	}
	if (barrier === "connected") {
		await until(() => connected, "actual DBOS admission never connected to the owned outage listener");
		assert.equal(jobTracker.get(runId), job, "control must target an outstanding admission");
		assert.equal(completedCalls, 0, "author work must not precede database admission");
	}
	const before = performance.now();
	if (action === "observe") {
		await job.promise;
		assert.equal(completedCalls, 0);
		assert.equal(backend.isAdmissionUnavailable(runId), true);
		const snapshot = store.runs().find((run) => run.id === runId);
		assert.equal(snapshot?.phase, "blocked_dependency");
		assert.match(snapshot?.dependencyError ?? "", /database unavailable/i);
		const statusStarted = performance.now();
		const status = await makeExecuteWorkflowTool(runtime, () => undefined)({ action: "status", runId }, {});
		assert.ok(performance.now() - statusStarted < 2_000, "status waited for the unavailable database");
		assert.equal(status.action, "statusDetail");
		assert.match(JSON.stringify(status), /blocked_dependency/);
		assert.ok(performance.now() - before < 12_000, "failed admission exceeded its bounded settlement");
	} else {
		const acknowledgement =
			action === "pause"
				? await workflowPauseAction({ action, runId })
				: await workflowQuitAction({ action, runId });
		assert.ok(acknowledgement.action === "pause" || acknowledgement.action === "quit");
		assert.ok(performance.now() - before < 2_000, "control acknowledgement waited for PostgreSQL recovery");
		if (phase === "admission") {
			assert.equal(acknowledgement.status, "paused", JSON.stringify(acknowledgement));
			assert.equal(store.runs().find((run) => run.id === runId)?.status, "paused");
			assert.equal(completedCalls, 0);
		} else {
			assert.equal(acknowledgement.status, "noop");
			assert.match(acknowledgement.message ?? "", /paused locally.*resumable durable progress/);
			assert.equal(store.runs().find((run) => run.id === runId)?.status, "paused");
		}
	}
	await sleep(200);
	await closeSink();
	await start();
	if (phase === "admission" && action === "quit") {
		await job.promise;
		assert.equal(completedCalls, 0, "late recovery must not admit a quit root");
		assert.equal(store.runs()[0]?.resumable, false, "a quit before any progress has nothing to replay");
		console.log(JSON.stringify({ phase, action, runId, completedCalls, cancelled: true }));
	} else {
		const resumed = await workflowResumeAction(
			{ action: "resume", runId },
			{
				getRuntime: () => runtime,
				policy: INTERACTIVE_WORKFLOW_POLICY,
				ensureWorkflowResourcesLoaded: async () => {},
			},
		);
		assert.equal(resumed.action, "resume");
		assert.notEqual(resumed.status, "noop", JSON.stringify(resumed));
		releaseFrontier?.();
		await until(
			() => store.runs().find((run) => run.id === runId)?.status === "completed",
			JSON.stringify(store.runs()),
		);
		await backend.flush(runId);
		assert.equal(completedCalls, 1, "completed author work was duplicated after same-ID recovery");
		assert.equal(store.runs().length, 1);
		const fresh = await configureDbosDurableBackend();
		await fresh.backend.hydrateWorkflow(runId);
		assert.equal(fresh.backend.getWorkflow(runId)?.status, "completed");
		assert.ok(
			fresh.backend
				.listCheckpoints(runId)
				.some((checkpoint) => checkpoint.kind === "tool" && checkpoint.name === "completed"),
		);
		console.log(JSON.stringify({ phase, action, runId, completedCalls, frontierCalls, persisted: true }));
	}
	await shutdownDbos();
} catch (error) {
	failure = error instanceof Error ? error : new Error(String(error));
} finally {
	await closeSink();
	await stop();
	clearTimeout(watchdog);
}
if (failure) {
	console.error(failure);
	process.exit(1);
}
process.exit(0);
