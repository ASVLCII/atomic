import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { endianness, tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test, vi } from "vitest";
import {
	acquirePostgresConsumer,
	managedPostgresMetadata,
	publishPostgresServer,
} from "../../packages/workflows/src/durable/dbos-postgres-ownership.js";
import type { WorkflowDependencyReport } from "../../packages/workflows/src/durable/dependency-doctor-types.js";

const state = vi.hoisted(() => ({
	root: "",
	unavailable: false,
	mismatch: false,
	provider: "unresolved",
	connectError: false,
	runtimeBroken: false,
	healthFailure: undefined as Error | undefined,
	recover: vi.fn(async () => {}),
	query: vi.fn(),
	end: vi.fn(),
	configs: [] as { connectionString?: string; port?: number }[],
	gate: undefined as Promise<void> | undefined,
}));
vi.mock("../../packages/workflows/src/durable/dbos-embedded-postgres-root.js", () => ({
	resolveEmbeddedRunContext: async () => {
		await state.gate;
		return { baseDir: state.root };
	},
}));
vi.mock("../../packages/workflows/src/durable/dbos-local-postgres.js", () => ({
	resolvedPostgresProvider: () => state.provider,
	postgresLastFailure: () => state.healthFailure,
	recoverManagedPostgres: state.recover,
}));
vi.mock("../../packages/workflows/src/durable/dependency-runtime.js", () => ({
	inspectPostgresRuntime: async () => {
		if (state.runtimeBroken) throw new Error("PostgreSQL runtime probe failed: missing library");
		return { executable: "/owned/runtime/postgres", version: "postgres (PostgreSQL) 18.4" };
	},
}));
vi.mock("pg", () => ({
	Client: class {
		host = "127.0.0.1";
		port = 5432;
		constructor(config: { connectionString?: string; port?: number }) {
			state.configs.push(config);
			if (config.connectionString) {
				const url = new URL(config.connectionString);
				this.host = url.searchParams.get("host") ?? url.hostname;
				this.port = Number(url.searchParams.get("port") ?? (url.port || "5432"));
			}
		}
		on() {}
		async connect() {
			if (state.connectError || state.unavailable)
				throw Object.assign(new Error("secret postgres://user:password@host/db"), { code: "ECONNREFUSED" });
		}
		async query(query: string | { text: string; query_timeout: number }) {
			state.query(query);
			const sql = typeof query === "string" ? query : query.text;
			return {
				rows: sql.includes("pg_control_system")
					? [
							{
								data_dir: join(state.root, "v18"),
								port: 6543,
								host: "127.0.0.1",
								started: "100",
								system_identifier: state.mismatch ? "99" : "42",
								server_version: "18.4",
							},
						]
					: [{ version: "18.4" }],
			};
		}
		async end() {
			state.end();
		}
	},
}));

import { workflowDependency } from "../../packages/workflows/src/durable/dependency-doctor.js";

beforeEach(() => {
	state.root = mkdtempSync(join(tmpdir(), "atomic-doctor-"));
	state.unavailable = false;
	state.runtimeBroken = false;
	state.healthFailure = undefined;
	state.mismatch = false;
	state.connectError = false;
	state.provider = "unresolved";
	state.configs.length = 0;
	state.gate = undefined;
	state.recover.mockReset();
	state.query.mockClear();
	state.end.mockClear();
	vi.stubEnv("DBOS_SYSTEM_DATABASE_URL", "");
	const bag = globalThis as typeof globalThis &
		Record<
			symbol,
			{
				pending?: Promise<WorkflowDependencyReport>;
				operation?: string;
				last?: WorkflowDependencyReport;
				failure?: string;
				healthFailure?: Error;
			}
		>;
	const owner = bag[Symbol.for("atomic-workflows/dependency-doctor@1")];
	assert.equal(owner.pending, undefined);
	delete owner.last;
	delete owner.failure;
	delete owner.healthFailure;
});
afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllEnvs();
	rmSync(state.root, { recursive: true, force: true });
});

function cluster() {
	const data = join(state.root, "v18");
	mkdirSync(join(data, "global"), { recursive: true });
	writeFileSync(join(data, "PG_VERSION"), "18");
	const control = Buffer.alloc(8);
	if (endianness() === "LE") control.writeBigUInt64LE(42n);
	else control.writeBigUInt64BE(42n);
	writeFileSync(join(data, "global", "pg_control"), control);
	writeFileSync(join(data, "postmaster.pid"), `${process.pid}\n${data}\n100\n6543\n`);
	const metadata = managedPostgresMetadata(state.root, 18, true);
	publishPostgresServer(state.root, metadata, { pid: process.pid, port: 6543, started: 100, systemIdentifier: "42" });
	return metadata;
}

// #3074: public diagnostics never provision or modify a cluster merely to inspect it.
test("status and doctor verify selected port, server/runtime identity and consumers without pruning", async () => {
	const metadata = cluster();
	const lease = acquirePostgresConsumer(state.root, metadata, "owned test runtime");
	const registry = join(state.root, "v18.shared");
	const abandoned = join(registry, "abandoned.consumer");
	writeFileSync(
		abandoned,
		JSON.stringify({ clusterId: metadata.clusterId, token: "abandoned", pid: 2147483647, runtime: "old" }),
		{ mode: 0o600 },
	);
	const before = readFileSync(join(registry, "cluster.json"), "utf8");
	for (const operation of ["status", "doctor"] as const) {
		const report = await workflowDependency(operation);
		assert.equal(report.state, "ready");
		assert.equal(report.identityVerified, true);
		assert.deepEqual(report.endpoint, { host: "127.0.0.1", port: 6543 });
		assert.equal(report.runtime.postgresVersion, "18.4");
		assert.equal(report.runtime.version, process.version);
		assert.equal(report.cluster?.clusterId, metadata.clusterId);
		assert.deepEqual(report.consumers, [lease.record]);
		assert.equal(readFileSync(join(registry, "cluster.json"), "utf8"), before);
		assert.match(readFileSync(abandoned, "utf8"), /abandoned/);
	}
	assert.equal(state.recover.mock.calls.length, 0);
});

test("recover refuses SQL identity mismatch and retains diagnostic after later success", async () => {
	cluster();
	state.mismatch = true;
	const failed = await workflowDependency("recover");
	assert.equal(failed.state, "unavailable");
	assert.match(failed.lastFailure!, /identity mismatch/);
	assert.equal(state.recover.mock.calls.length, 0);
	state.mismatch = false;
	const ready = await workflowDependency("doctor");
	assert.equal(ready.state, "ready");
	assert.equal(ready.lastFailure, failed.lastFailure);
});

// #3072/#3074: retained health diagnostics must not displace a newer doctor failure.
test.each([false, true])("retains newer doctor failure with registered cluster %s", async (registered) => {
	if (registered) cluster();
	state.healthFailure = new Error("older recovered database outage");
	assert.equal((await workflowDependency("status")).lastFailure, state.healthFailure.message);
	state.runtimeBroken = true;
	const failed = await workflowDependency("doctor");
	assert.equal(failed.state, "unavailable");
	assert.match(failed.lastFailure!, /missing library/);
	state.runtimeBroken = false;
	for (const operation of ["status", "doctor"] as const) {
		const report = await workflowDependency(operation);
		assert.equal(report.state, registered ? "ready" : "uninitialized");
		assert.equal(report.lastFailure, failed.lastFailure);
	}
});

// #3072/#3074: a new health failure wins even when its message repeats an older outage.
test("newer health failure supersedes retained doctor failure", async () => {
	cluster();
	state.healthFailure = new Error("repeated database outage");
	await workflowDependency("status");
	state.runtimeBroken = true;
	const failed = await workflowDependency("doctor");
	assert.match(failed.lastFailure!, /missing library/);
	state.runtimeBroken = false;
	state.healthFailure = new Error("repeated database outage");
	for (const operation of ["status", "doctor"] as const) {
		const report = await workflowDependency(operation);
		assert.equal(report.state, "ready");
		assert.equal(report.lastFailure, state.healthFailure.message);
	}
});

// #3074: failures before health inspection must also supersede the retained health error.
test("context failure remains newer than an existing health failure", async () => {
	state.healthFailure = new Error("older recovered database outage");
	state.gate = Promise.reject(new Error("newer context failure"));
	const failed = await workflowDependency("doctor");
	assert.equal(failed.state, "unavailable");
	assert.equal(failed.lastFailure, "newer context failure");
	state.gate = undefined;
	assert.equal((await workflowDependency("status")).lastFailure, failed.lastFailure);
});

test("recover refuses published process start mismatch", async () => {
	const metadata = cluster();
	publishPostgresServer(state.root, metadata, { pid: process.pid, port: 6543, started: 99, systemIdentifier: "42" });
	const report = await workflowDependency("recover");
	assert.equal(report.state, "unavailable");
	assert.match(report.lastFailure!, /Published managed server identity/);
	assert.equal(state.recover.mock.calls.length, 0);
});

test("only explicit recover repairs unavailable registered cluster and verifies afterwards", async () => {
	cluster();
	state.unavailable = true;
	assert.equal((await workflowDependency("doctor")).state, "unavailable");
	assert.equal(state.recover.mock.calls.length, 0);
	state.recover.mockImplementation(async () => {
		state.unavailable = false;
	});
	const report = await workflowDependency("recover");
	assert.equal(report.state, "ready");
	assert.equal(report.identityVerified, true);
	assert.equal(state.recover.mock.calls.length, 1);
});

test("unregistered data and Docker provider never grant recovery authority", async () => {
	mkdirSync(join(state.root, "v18"));
	writeFileSync(join(state.root, "v18", "precious"), "keep");
	assert.equal((await workflowDependency("recover")).state, "uninitialized");
	state.provider = "docker";
	assert.equal((await workflowDependency("recover")).provider, "docker");
	assert.equal(state.recover.mock.calls.length, 0);
	assert.equal(state.configs.length, 0);
	assert.equal(readFileSync(join(state.root, "v18", "precious"), "utf8"), "keep");
});

test("external recovery only queries configured endpoint and never discloses credentials", async () => {
	vi.stubEnv("DBOS_SYSTEM_DATABASE_URL", "postgres://user:password@example.test:7654/private?sslmode=require");
	state.connectError = true;
	const failed = await workflowDependency("recover");
	assert.equal(failed.provider, "external");
	assert.equal(failed.state, "unavailable");
	assert.deepEqual(failed.endpoint, { host: "example.test", port: 7654 });
	assert.doesNotMatch(JSON.stringify(failed), /password|private|postgres:\/\//);
	assert.equal(state.recover.mock.calls.length, 0);
	assert.equal(state.configs[0].connectionString, process.env.DBOS_SYSTEM_DATABASE_URL);
	state.connectError = false;
	const healthy = await workflowDependency("doctor");
	assert.equal(healthy.state, "ready");
	assert.equal(healthy.identityVerified, false);
	assert.equal(state.end.mock.calls.length, 2);
});

test("bounded response coalesces recovery and reports continuing work without duplicate starts", async () => {
	cluster();
	state.unavailable = true;
	vi.useFakeTimers();
	let release!: () => void;
	state.recover.mockImplementation(async () => {
		await new Promise<void>((resolve) => {
			release = resolve;
		});
		state.unavailable = false;
	});
	const first = workflowDependency("recover");
	await vi.advanceTimersByTimeAsync(5000);
	assert.equal((await first).state, "recovering");
	const second = workflowDependency("recover");
	await vi.advanceTimersByTimeAsync(5000);
	assert.equal((await second).state, "recovering");
	assert.equal(state.recover.mock.calls.length, 1);
	const status = workflowDependency("status");
	release();
	assert.equal((await status).state, "ready");
});

test("doctor diagnoses broken runtime while status can still inspect an existing server", async () => {
	cluster();
	state.runtimeBroken = true;
	const failed = await workflowDependency("doctor");
	assert.equal(failed.state, "unavailable");
	assert.match(failed.lastFailure!, /missing library/);
	assert.equal(failed.endpoint?.port, 6543);
	assert.equal(state.recover.mock.calls.length, 0);
	assert.equal((await workflowDependency("status")).state, "ready");
});

test("recovery requested during status inspection is not silently discarded", async () => {
	cluster();
	state.unavailable = true;
	let release!: () => void;
	state.gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	state.recover.mockImplementation(async () => {
		state.unavailable = false;
	});
	const status = workflowDependency("status");
	const recovery = workflowDependency("recover");
	release();
	assert.equal((await status).state, "ready");
	assert.equal((await recovery).state, "ready");
	assert.equal(state.recover.mock.calls.length, 1);
});

test("external report uses driver-selected endpoint and enforces query timeout over URL options", async () => {
	vi.stubEnv(
		"DBOS_SYSTEM_DATABASE_URL",
		"postgres://user:secret@original.test:5432/db?host=actual.test&port=6544&query_timeout=0",
	);
	const report = await workflowDependency("doctor");
	assert.deepEqual(report.endpoint, { host: "actual.test", port: 6544 });
	assert.equal(state.query.mock.calls[0][0].query_timeout, 1000);
	assert.equal(state.recover.mock.calls.length, 0);
});
