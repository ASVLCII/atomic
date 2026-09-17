import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import pg from "pg";
import {
	embeddedDbosSystemDatabaseUrl,
	ensureEmbeddedDbosPostgres,
	loadEmbeddedPostgresBinaries,
	shutdownEmbeddedDbosPostgres,
} from "../../packages/workflows/src/durable/dbos-embedded-postgres.js";
import { managedPostgresMetadata } from "../../packages/workflows/src/durable/dbos-postgres-ownership.js";
import { workflowDependency } from "../../packages/workflows/src/durable/dependency-doctor.js";
import { runLocalCommand } from "../../packages/workflows/src/durable/local-command.js";

const home = process.env.ATOMIC_FAULT_TEST_HOME;
assert.ok(home && resolve(homedir()) === resolve(home), "requires disposable HOME");
assert.notEqual(process.getuid?.(), 0, "root uses shared /var/lib; refuse fault injection");
const base = join(home, ".atomic", "postgres");
const data = join(base, "v18");
const lines = createInterface({ input: process.stdin });
for await (const line of lines) {
	const { id, command, sql } = JSON.parse(line) as { id: number; command: string; sql?: string };
	try {
		let result: object | string = {};
		if (command === "ensure") {
			await ensureEmbeddedDbosPostgres();
			result = { url: embeddedDbosSystemDatabaseUrl(), metadata: managedPostgresMetadata(base, 18, false) };
		} else if (command === "query") {
			const client = new pg.Client({
				connectionString: embeddedDbosSystemDatabaseUrl().replace("/atomic_workflows_dbos_sys?", "/postgres?"),
				connectionTimeoutMillis: 2000,
				query_timeout: 2000,
			});
			await client.connect();
			try {
				result = (await client.query(sql!)).rows;
			} finally {
				await client.end();
			}
		} else if (command === "binaries") {
			result = await loadEmbeddedPostgresBinaries({ readOnly: true });
		} else if (command === "recover") {
			result = await workflowDependency("recover");
		} else if (command === "doctor") {
			result = await workflowDependency("doctor");
		} else if (command === "stop") {
			// Only this fixture's directory is ever passed to pg_ctl, never a supplied PID/port.
			if (existsSync(join(data, "postmaster.pid"))) {
				const binaries = await loadEmbeddedPostgresBinaries();
				const stopped = await runLocalCommand(binaries.pg_ctl, [
					"-D",
					data,
					"-m",
					"fast",
					"-w",
					"-t",
					"15",
					"stop",
				]);
				assert.equal(stopped.exitCode, 0, stopped.stderr);
			}
		} else if (command === "exit") {
			await shutdownEmbeddedDbosPostgres();
			console.log(JSON.stringify({ id, result }));
			process.exit(0);
		} else throw new Error(`Unknown command ${command}`);
		console.log(JSON.stringify({ id, result }));
	} catch (error) {
		console.log(JSON.stringify({ id, error: String(error) }));
	}
}
