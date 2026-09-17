import assert from "node:assert/strict";
import { basename, join } from "node:path";
import { test } from "vitest";
import type { WorkflowDependencyReport } from "../../packages/workflows/src/durable/dependency-doctor-types.js";
import { RealPostgresHome, reserveListener } from "../helpers/real-postgres.js";
import { copyFileSync, fileExistsSync, makeDirectorySync } from "../helpers/runtime.js";

// Real runtime executables and diagnostic child processes require bounded cleanup.
const REAL_POSTGRES_PROCESS_TIMEOUT_MS = 120_000;

// #3074: copy the real executables but deliberately omit their runtime libraries.
// Never rename/delete a library in an installed or shared PostgreSQL runtime.
test(
	"missing private runtime libraries fail real executable preflight without initializing data",
	async () => {
		const home = new RealPostgresHome();
		try {
			const source = home.client(5439);
			const binaries = await source.request<Record<string, string>>("binaries");
			const runtime = join(home.path, "broken-runtime");
			makeDirectorySync(join(runtime, "bin"), { recursive: true });
			for (const binary of Object.values(binaries)) copyFileSync(binary, join(runtime, "bin", basename(binary)));
			const broken = home.client(5439, { ATOMIC_POSTGRES_RUNTIME_DIR: runtime });
			await assert.rejects(broken.request("ensure"), /incomplete PostgreSQL runtime.*broken-runtime/s);
			const report = await broken.request<WorkflowDependencyReport>("doctor");
			assert.equal(report.state, "unavailable");
			assert.match(JSON.stringify(report), /runtime|library|libraries|dll/i);
			assert.equal(fileExistsSync(join(home.path, ".atomic", "postgres", "v18", "PG_VERSION")), false);
		} finally {
			await home.cleanup();
		}
	},
	REAL_POSTGRES_PROCESS_TIMEOUT_MS,
);

// #3074: an explicit endpoint never becomes permission to provision a replacement.
test(
	"explicit external endpoint failure stays external during doctor and recovery",
	async () => {
		const home = new RealPostgresHome();
		const endpoint = await reserveListener();
		try {
			const url = `postgresql://postgres:atomic@127.0.0.1:${endpoint.port}/unavailable?sslmode=disable`;
			const external = home.client(5439, { DBOS_SYSTEM_DATABASE_URL: url });
			for (const operation of ["doctor", "recover"]) {
				const started = performance.now();
				const report = await external.request<WorkflowDependencyReport>(operation);
				assert.ok(performance.now() - started < 5000, `${operation} must be bounded`);
				assert.equal(report.state, "unavailable");
				assert.equal(report.provider, "external");
				assert.match(report.guidance, /external|configured.*endpoint/i);
				assert.equal(fileExistsSync(join(home.path, ".atomic", "postgres")), false);
			}
		} finally {
			try {
				await home.cleanup();
			} finally {
				await endpoint.close();
			}
		}
	},
	REAL_POSTGRES_PROCESS_TIMEOUT_MS,
);
