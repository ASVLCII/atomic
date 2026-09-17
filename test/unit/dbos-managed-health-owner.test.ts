import assert from "node:assert/strict";
import { test } from "vitest";
import { resolvedPostgresHealth } from "../../packages/workflows/src/durable/dbos-managed-health.js";
import { PostgresHealth } from "../../packages/workflows/src/durable/dbos-postgres-health.js";

// #3074: admission configuration consults the retained owner without provisioning a server.
test("managed health lookup uses the retained owner and preserves its endpoint guard", () => {
	const key = Symbol.for("atomic-workflows/local-postgres-owner@1");
	const previous = Object.getOwnPropertyDescriptor(globalThis, key);
	const health = Object.create(PostgresHealth.prototype) as PostgresHealth;
	try {
		Reflect.deleteProperty(globalThis, key);
		assert.equal(resolvedPostgresHealth(), undefined);
		Object.defineProperty(globalThis, key, { configurable: true, value: {} });
		assert.equal(resolvedPostgresHealth(), undefined);
		Object.defineProperty(globalThis, key, {
			configurable: true,
			value: { health: (url?: string) => (url === "managed" ? health : undefined) },
		});
		assert.equal(resolvedPostgresHealth("managed"), health);
		assert.equal(resolvedPostgresHealth("external"), undefined);
	} finally {
		if (previous) Object.defineProperty(globalThis, key, previous);
		else Reflect.deleteProperty(globalThis, key);
	}
});
