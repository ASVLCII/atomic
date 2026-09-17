import { existsSync } from "node:fs";
import { Client } from "pg";
import { resolveEmbeddedRunContext } from "./dbos-embedded-postgres-root.js";
import { postgresLastFailure, recoverManagedPostgres, resolvedPostgresProvider } from "./dbos-local-postgres.js";
import { probePostgresIdentity, verifyPostgresIdentity } from "./dbos-postgres-identity.js";
import {
	inspectPostgresConsumers,
	managedPostgresMetadata,
	postgresOwnershipDirectory,
} from "./dbos-postgres-ownership.js";

import type { WorkflowDependencyOperation, WorkflowDependencyReport } from "./dependency-doctor-types.js";
import { inspectPostgresRuntime } from "./dependency-runtime.js";

export type { WorkflowDependencyOperation, WorkflowDependencyReport } from "./dependency-doctor-types.js";

const PRESERVE =
	"Preserve the data directory and ownership records. Never delete them or kill a listener to free a port.";
const RESPONSE_BUDGET_MS = 5_000;
interface DoctorOwner {
	pending?: Promise<WorkflowDependencyReport>;
	operation?: WorkflowDependencyOperation;
	last?: WorkflowDependencyReport;
	failure?: string;
}
const ownerKey = Symbol.for("atomic-workflows/dependency-doctor@1");
const bag = globalThis as typeof globalThis & Record<symbol, DoctorOwner | undefined>;
const owner = bag[ownerKey] ?? {};
bag[ownerKey] = owner;

/** Inspect without provisioning; explicit recovery only restarts the registered managed cluster. */
export async function workflowDependency(
	operation: WorkflowDependencyOperation = "status",
): Promise<WorkflowDependencyReport> {
	if (!["status", "doctor", "recover"].includes(operation)) throw new Error("Invalid dependency operation.");
	if (!owner.pending) {
		owner.operation = operation;
		owner.pending = inspect(operation)
			.then(async (report) => {
				// Stronger requests arriving during inspection must not be lost.
				let completed = operation;
				while (owner.operation && owner.operation !== completed) {
					completed = owner.operation;
					report = await inspect(completed);
				}
				return report;
			})
			.then((report) => {
				owner.last = report;
				return report;
			})
			.finally(() => {
				owner.pending = undefined;
				owner.operation = undefined;
			});
	} else if (operation === "recover" || (operation === "doctor" && owner.operation === "status")) {
		owner.operation = operation;
	}
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			owner.pending,
			new Promise<WorkflowDependencyReport>((resolve) => {
				timer = setTimeout(
					() =>
						resolve({
							...(owner.last ?? initialReport()),
							state: owner.operation === "recover" ? "recovering" : "checking",
							identityVerified: false,
							guidance:
								"Dependency inspection or recovery is still in progress. Use /workflow dependency status; do not start a replacement run.",
						}),
					RESPONSE_BUDGET_MS,
				);
			}),
		]);
	} finally {
		if (timer !== undefined) clearTimeout(timer);
	}
}

function initialReport(): WorkflowDependencyReport {
	return {
		provider: process.env.DBOS_SYSTEM_DATABASE_URL?.trim()
			? "external"
			: resolvedPostgresProvider() === "docker"
				? "docker"
				: "managed",
		state: "uninitialized",
		runtime: { executable: process.execPath, version: process.version },
		identityVerified: false,
		consumers: [],
		lastFailure: owner.failure,
		guidance: PRESERVE,
	};
}

async function inspect(operation: WorkflowDependencyOperation): Promise<WorkflowDependencyReport> {
	let report = initialReport();
	try {
		if (report.provider !== "managed") {
			const explicit = process.env.DBOS_SYSTEM_DATABASE_URL?.trim();
			if (!explicit)
				return {
					...report,
					state: "unavailable",
					guidance:
						"Docker fallback is selected. Inspect the dbos-db container with your Docker tools. Atomic dependency recovery does not change Docker containers.",
				};
			const url = new URL(explicit);
			if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error("Invalid PostgreSQL URL.");
			const client = new Client({
				connectionString: explicit,
				connectionTimeoutMillis: 1000,
				query_timeout: 1000,
				statement_timeout: 1000,
			});
			report = { ...report, endpoint: { host: client.host, port: client.port } };
			client.on("error", () => {});
			try {
				await client.connect();
				// Per-query timeout cannot be disabled by a query_timeout URL parameter.
				const query = { text: "SELECT current_setting('server_version') AS version", query_timeout: 1000 };
				const result = await client.query<{ version: string }>(query);
				report = {
					...report,
					state: "ready",
					runtime: { ...report.runtime, postgresVersion: result.rows[0]?.version },
				};
			} finally {
				await client.end();
			}
			return {
				...report,
				checkedAt: new Date().toISOString(),
				guidance:
					"Configured external endpoint responded. Atomic never restarts or replaces it. Resume the existing workflow ID after confirming its status.",
			};
		}
		const context = await resolveEmbeddedRunContext();
		owner.failure = postgresLastFailure()?.message ?? owner.failure;
		report = { ...report, lastFailure: owner.failure };
		if (!existsSync(postgresOwnershipDirectory(context.baseDir, 18))) {
			if (operation === "doctor") report = await withRuntime(report);
			return {
				...report,
				guidance:
					"No registered managed cluster. Start a workflow to provision one, or configure DBOS_SYSTEM_DATABASE_URL. If data already exists, preserve it; recover will not adopt or initialize it.",
			};
		}
		let metadata = managedPostgresMetadata(context.baseDir, 18, false);
		report = {
			...report,
			cluster: metadata,
			endpoint: metadata.server ? { host: "127.0.0.1", port: metadata.server.port } : undefined,
			consumers: inspectPostgresConsumers(context.baseDir, metadata, undefined, false),
			lastFailure: postgresLastFailure()?.message ?? owner.failure,
		};
		if (operation !== "status") report = await withRuntime(report);
		if (!metadata.server)
			throw new Error("Registered cluster has no published server identity; automatic recovery refused.");
		let postgresVersion: string | undefined;
		const probe = async () =>
			verifyPostgresIdentity(metadata, metadata.server!.port, metadata.server!.pid, async (port) => {
				const row = await probePostgresIdentity(port);
				postgresVersion = row?.server_version;
				return row;
			});
		let live = await probe();
		if (!live && operation === "recover") {
			await recoverManagedPostgres(context, metadata);
			metadata = managedPostgresMetadata(context.baseDir, 18, false);
			live = await probe();
		}
		if (!live) throw new Error("Managed PostgreSQL did not pass its SQL/data/process identity check.");
		if (
			!metadata.server ||
			live.pid !== metadata.server.pid ||
			live.started !== metadata.server.started ||
			live.port !== metadata.server.port ||
			live.systemIdentifier !== metadata.server.systemIdentifier
		)
			throw new Error("Published managed server identity changed; recovery refused.");
		report = {
			...report,
			cluster: metadata,
			endpoint: { host: "127.0.0.1", port: live.port },
			consumers: inspectPostgresConsumers(context.baseDir, metadata, undefined, false),
		};
		return {
			...report,
			state: "ready",
			identityVerified: true,
			checkedAt: new Date().toISOString(),
			runtime: { ...report.runtime, postgresVersion },
			guidance:
				"Managed cluster identity verified. Resume the existing workflow ID; recovery does not rerun workflow bodies. " +
				PRESERVE,
		};
	} catch (error) {
		// External driver diagnostics can contain credentials or server-supplied text. Never publish them.
		owner.failure =
			report.provider === "external"
				? "Configured external PostgreSQL endpoint failed its bounded health query. Check the URL, credentials, TLS settings and database service."
				: (error instanceof Error ? error.message : "Dependency inspection failed.").replace(
						/postgres(?:ql)?:\/\/\S+/gi,
						"[redacted database URL]",
					);
		return {
			...report,
			state: "unavailable",
			identityVerified: false,
			checkedAt: new Date().toISOString(),
			lastFailure: owner.failure,
			guidance:
				report.provider === "external"
					? "Repair only the configured external endpoint, then run /workflow dependency doctor. Atomic will not provision a replacement."
					: "Check the reported identity and PostgreSQL runtime installation. Use /workflow dependency recover to retry only the registered cluster under its shared setup lock. Identity mismatches require manual investigation. " +
						PRESERVE,
		};
	}
}

async function withRuntime(report: WorkflowDependencyReport): Promise<WorkflowDependencyReport> {
	return { ...report, runtime: { ...report.runtime, installation: await inspectPostgresRuntime() } };
}
