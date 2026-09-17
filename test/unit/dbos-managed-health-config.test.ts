import assert from "node:assert/strict";
import { Client, Pool } from "pg";
import { afterEach, test, vi } from "vitest";
import { DbosDependencyError, dbosAdmissionContext } from "../../packages/workflows/src/durable/dbos-admission.js";
import { configureAdmissionDatabase } from "../../packages/workflows/src/durable/dbos-admission-config.js";
import { PostgresHealth } from "../../packages/workflows/src/durable/dbos-postgres-health.js";
import type { DbosConfiguration } from "../../packages/workflows/src/durable/dbos-sdk-handle.js";

const local = vi.hoisted(() => ({ health: undefined as PostgresHealth | undefined }));
vi.mock("../../packages/workflows/src/durable/dbos-local-postgres.js", () => ({
	resolvedPostgresHealth: () => local.health,
}));
vi.mock("@dbos-inc/dbos-sdk/datasource", async (original) => ({
	...(await original<typeof import("@dbos-inc/dbos-sdk/datasource")>()),
	ensurePGDatabase: vi.fn(async () => ({ status: "already_exists", notes: [], message: "exists" })),
}));
const initialUrl = "postgresql://fixture:unused@127.0.0.1:1/isolated?sslmode=disable";
const config: DbosConfiguration = {
	name: "isolated-health-config",
	systemDatabaseUrl: initialUrl,
	executorID: "isolated",
	runAdminServer: false,
	logger: { info() {}, warn() {}, error() {}, debug() {} },
};
afterEach(async () => {
	await local.health?.stop();
	local.health = undefined;
	vi.restoreAllMocks();
});

// #3074: reconnect the SDK's existing pool reference, not a newly launched executor.
test("configured DBOS consumers follow recovered ports without relaunch or reconfiguration", async () => {
	let healthy = true,
		url = initialUrl,
		recoveries = 0;
	local.health = new PostgresHealth({
		probe: async () => (healthy ? { url, identity: url } : undefined),
		recover: async () => {
			recoveries++;
			healthy = true;
			url = initialUrl.replace(":1/", ":2/");
		},
	});
	const connect = vi
		.spyOn(Pool.prototype, "connect")
		.mockImplementation(async () => Object.assign(new Client(), { release: vi.fn() }));
	const sdk = { setConfig: vi.fn<(config: DbosConfiguration) => void>(), launch: vi.fn(async () => {}) };
	const database = configureAdmissionDatabase(sdk, config);
	const pool = sdk.setConfig.mock.calls[0][0].systemDatabasePool!;
	try {
		await database.launch();
		(await pool.connect()).release();
		healthy = false;
		(await pool.connect()).release();
		assert.equal(recoveries, 1);
		assert.equal(connect.mock.calls.length, 2);
		assert.equal(pool.options.connectionString, url);
		assert.equal(sdk.launch.mock.calls.length, 1);
		assert.equal(sdk.setConfig.mock.calls.length, 1);
	} finally {
		await pool.end();
	}
});

// #3072: shared recovery may finish after one admission's deadline; its borrow stays fenced.
test("cancelling admission during shared recovery cannot return a late usable client", async () => {
	let healthy = false;
	let release!: () => void;
	let entered!: () => void;
	const recovering = new Promise<void>((resolve) => {
		entered = resolve;
	});
	local.health = new PostgresHealth({
		probe: async () => (healthy ? { url: initialUrl, identity: "recovered" } : undefined),
		recover: async () => {
			entered();
			await new Promise<void>((resolve) => {
				release = resolve;
			});
			healthy = true;
		},
	});
	const releaseClient = vi.fn();
	const borrowed = Object.assign(new Client(), { release: releaseClient });
	vi.spyOn(Pool.prototype, "connect").mockImplementation(async () => borrowed);
	const sdk = { setConfig: vi.fn<(config: DbosConfiguration) => void>(), launch: vi.fn(async () => {}) };
	configureAdmissionDatabase(sdk, config);
	const pool = sdk.setConfig.mock.calls[0][0].systemDatabasePool!;
	const controller = new AbortController();
	const pending = dbosAdmissionContext.run(controller.signal, () => pool.connect());
	await recovering;
	controller.abort(new DbosDependencyError());
	await assert.rejects(pending, DbosDependencyError);
	release();
	await local.health.check();
	await new Promise<void>((resolve) => setImmediate(resolve));
	assert.deepEqual(releaseClient.mock.calls, [[true]]);
	await pool.end();
});
