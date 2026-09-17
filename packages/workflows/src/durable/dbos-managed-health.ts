import type { PostgresHealth } from "./dbos-postgres-health.js";

/** Consult the already-resolved owner without importing managed-server provisioning. */
export function resolvedPostgresHealth(url?: string): PostgresHealth | undefined {
	const ownerKey = Symbol.for("atomic-workflows/local-postgres-owner@1");
	const owners = globalThis as typeof globalThis &
		Record<symbol, { health?: (url?: string) => PostgresHealth | undefined } | undefined>;
	return owners[ownerKey]?.health?.(url);
}
