import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "vitest";
import { bunExecutable, makeTempDirectory, removeTempDirectory, spawnProcess } from "../helpers/runtime.js";

// Real initdb + PostgreSQL + DBOS child per case. Startup, outage and shutdown are structural work.
const REAL_POSTGRES_OUTAGE_TIMEOUT_MS = 120_000;
for (const [phase, action] of [
	["admission", "observe"],
	["admission", "pause"],
	["admission", "quit"],
	["checkpoint", "quit"],
] as const) {
	// #3072/#3074: never connect these fault injectors to an inherited database.
	test(
		`real PostgreSQL ${phase} loss: bounded ${action} preserves completed work without late admission`,
		async () => {
			const home = makeTempDirectory("atomic-owned-workflow-outage-");
			const child = spawnProcess(
				[bunExecutable(), "test/fixtures/workflow-postgres-real-outage.ts", home, phase, action],
				{
					env: {
						...process.env,
						HOME: home,
						USERPROFILE: home,
						DBOS_SYSTEM_DATABASE_URL: undefined,
						ATOMIC_POSTGRES_RUNTIME_DIR: undefined,
						ATOMIC_WORKFLOW_ARTIFACT_DIR: join(home, "artifacts"),
					},
					stdout: "pipe",
					stderr: "pipe",
					timeout: REAL_POSTGRES_OUTAGE_TIMEOUT_MS - 5_000,
				},
			);
			const [exit, stdout, stderr] = await Promise.all([
				child.exited,
				new Response(child.stdout).text(),
				new Response(child.stderr).text(),
			]);
			assert.equal(exit, 0, `Owned fixture retained at ${home}\n${stdout}\n${stderr}`);
			if (phase === "admission" && action === "quit") {
				assert.match(stdout, /"completedCalls":0/);
				assert.match(stdout, /"cancelled":true/);
			} else {
				assert.match(stdout, /"completedCalls":1/);
				assert.match(stdout, /"persisted":true/);
			}
			removeTempDirectory(home);
		},
		REAL_POSTGRES_OUTAGE_TIMEOUT_MS,
	);
}
