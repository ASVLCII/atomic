import assert from "node:assert/strict";
import { beforeEach, test, vi } from "vitest";

const probes = vi.hoisted(() => ({
	load: vi.fn(async () => ({ postgres: "/owned/postgres", pg_ctl: "/owned/pg_ctl", initdb: "/owned/initdb" })),
	calls: [] as { binary: string; args: readonly string[]; timeout: number; maxBuffer: number }[],
	failure: "",
	version: "18.4",
}));
vi.mock("../../packages/workflows/src/durable/dbos-embedded-postgres.js", () => ({
	loadEmbeddedPostgresBinaries: probes.load,
}));
vi.mock("node:child_process", () => ({
	execFile: (
		binary: string,
		args: readonly string[],
		options: { timeout: number; maxBuffer: number },
		callback: (error: Error | null, stdout: string, stderr: string) => void,
	) => {
		probes.calls.push({ binary, args, ...options });
		callback(
			probes.failure ? new Error("probe failed") : null,
			`postgres (PostgreSQL) ${probes.version}`,
			probes.failure,
		);
	},
}));

import { inspectPostgresRuntime } from "../../packages/workflows/src/durable/dependency-runtime.js";

beforeEach(() => {
	probes.calls.length = 0;
	probes.failure = "";
	probes.version = "18.4";
	probes.load.mockClear();
});

// #3074: diagnostics execute version-only commands and never repair runtime permissions.
test("runtime doctor checks every binary with a bounded version-only command and read-only discovery", async () => {
	assert.deepEqual(await inspectPostgresRuntime(), {
		executable: "/owned/postgres",
		version: "postgres (PostgreSQL) 18.4",
	});
	assert.deepEqual(probes.load.mock.calls, [[{ readOnly: true }]]);
	assert.deepEqual(
		probes.calls.map((call) => call.binary),
		["/owned/postgres", "/owned/pg_ctl", "/owned/initdb"],
	);
	for (const call of probes.calls) {
		assert.deepEqual(call.args, ["--version"]);
		assert.equal(call.timeout, 1000);
		assert.equal(call.maxBuffer, 16384);
	}
});
test("missing runtime libraries and wrong major give actionable errors rather than a healthy runtime", async () => {
	probes.failure = "libssl missing";
	await assert.rejects(inspectPostgresRuntime(), /runtime probe failed.*libssl missing/);
	probes.failure = "";
	probes.version = "17.1";
	await assert.rejects(inspectPostgresRuntime(), /Expected PostgreSQL 18 runtime/);
});
