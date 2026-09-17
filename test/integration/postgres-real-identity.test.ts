import assert from "node:assert/strict";
import { join } from "node:path";
import { Client } from "pg";
import { test } from "vitest";
import {
	managedPostmaster,
	POSTGRES_IDENTITY_SQL,
	type PostgresIdentityRow,
	verifyPostgresIdentity,
} from "../../packages/workflows/src/durable/dbos-postgres-identity.js";
import { managedPostgresMetadata } from "../../packages/workflows/src/durable/dbos-postgres-ownership.js";
import { type ManagedResult, RealPostgresHome, reserveListener } from "../helpers/real-postgres.js";

const REAL_POSTGRES_PROCESS_TIMEOUT_MS = 120_000;

// #3072/#3074: MyStartTime (pidfile) and PgStartTime (SQL) are sampled separately.
// Inject the second boundary in SQL, not by hoping a real startup straddles it.
test(
	"SQL identity accepts a postmaster whose SQL start time crosses a second boundary",
	async () => {
		const home = new RealPostgresHome();
		const reservation = await reserveListener();
		await reservation.close();
		let client: Client | undefined;
		try {
			const owner = home.client(reservation.port);
			const result = await owner.request<ManagedResult>("ensure");
			const metadata = managedPostgresMetadata(join(home.path, ".atomic", "postgres"), 18, false);
			const before = managedPostmaster(metadata)!;
			client = new Client({
				connectionString: result.url.replace("/atomic_workflows_dbos_sys?", "/postgres?"),
				connectionTimeoutMillis: 2000,
				query_timeout: 2000,
			});
			await client.connect();
			await client.query(`CREATE SCHEMA boundary;
			CREATE FUNCTION boundary.pg_postmaster_start_time() RETURNS timestamptz
			LANGUAGE SQL AS 'SELECT to_timestamp(${before.started + 1})';
			SET search_path = boundary, pg_catalog`);
			const observed = await client.query<{ started: string }>(
				"SELECT floor(extract(epoch FROM pg_postmaster_start_time()))::text AS started",
			);
			assert.equal(Number(observed.rows[0].started), before.started + 1);
			const connection = client;
			assert.deepEqual(
				await verifyPostgresIdentity(
					metadata,
					before.port,
					before.pid,
					async () => (await connection.query<PostgresIdentityRow>(POSTGRES_IDENTITY_SQL)).rows[0],
				),
				before,
			);
			assert.deepEqual(managedPostmaster(metadata), before);
		} finally {
			try {
				await client?.end();
			} finally {
				await home.cleanup();
			}
		}
	},
	REAL_POSTGRES_PROCESS_TIMEOUT_MS,
);
