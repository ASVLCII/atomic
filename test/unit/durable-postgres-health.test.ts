import assert from "node:assert/strict";
import { test, vi } from "vitest";
import { PostgresHealth } from "../../packages/workflows/src/durable/dbos-postgres-health.js";

// #3074: health loss is shared by concurrent consumers, not a fresh startup per caller.
test("health loss invalidates before a single shared recovery and reconnects", async () => {
	let healthy = true;
	let recoveries = 0;
	const events: string[] = [];
	const health = new PostgresHealth({
		probe: async () => (healthy ? { url: "managed", identity: "1" } : undefined),
		recover: async () => {
			recoveries++;
			events.push("recover");
			healthy = true;
		},
		wait: async () => {},
	});
	health.subscribe(() => events.push("invalidate"));
	assert.equal(await health.check(), "managed");
	healthy = false;
	assert.deepEqual(await Promise.all([health.check(), health.check(), health.check()]), [
		"managed",
		"managed",
		"managed",
	]);
	assert.equal(recoveries, 1);
	assert.deepEqual(events, ["invalidate", "recover"]);
	assert.match(health.lastFailure?.message ?? "", /live health check/);
	await health.stop();
});

// #3074: one outage has a finite retry budget, including repeated callers and timer polls.
test("exhausted recovery probes for return without restarting forever", async () => {
	let healthy = false;
	let recoveries = 0;
	const waits: number[] = [];
	const health = new PostgresHealth({
		probe: async () => (healthy ? { url: "managed", identity: "1" } : undefined),
		recover: async () => {
			recoveries++;
			throw new Error("owned restart failed");
		},
		wait: async (ms) => {
			waits.push(ms);
		},
	});
	await assert.rejects(health.check(), /unavailable after bounded recovery/);
	await assert.rejects(health.check(), /unavailable after bounded recovery/);
	assert.equal(health.lastFailure?.message, "owned restart failed");
	assert.equal(recoveries, 3);
	assert.deepEqual(waits, [250, 500]);
	healthy = true;
	assert.equal(await health.check(), "managed");
	// #3074: doctor retains the last outage diagnostic after successful recovery.
	assert.equal(health.lastFailure?.message, "owned restart failed");
	await health.stop();
});

test("identity failure invalidates but never grants recovery authority", async () => {
	let recoveries = 0,
		invalidations = 0;
	const health = new PostgresHealth({
		probe: async () => {
			throw new Error("identity mismatch");
		},
		recover: async () => {
			recoveries++;
		},
	});
	health.subscribe(() => invalidations++);
	await assert.rejects(health.check(), /identity mismatch/);
	assert.equal(recoveries, 0);
	assert.equal(invalidations, 1);
	await health.stop();
});

test("peer recovery on the same port invalidates the previous process generation", async () => {
	let identity = "old",
		invalidations = 0;
	const health = new PostgresHealth({
		probe: async () => ({ url: "same-port", identity }),
		recover: async () => {
			throw new Error("peer already recovered");
		},
	});
	health.subscribe(() => invalidations++);
	await health.check();
	identity = "new";
	assert.equal(await health.check(), "same-port");
	assert.equal(invalidations, 1);
	await health.stop();
});

test("stop during backoff prevents another recovery attempt", async () => {
	let release!: () => void;
	let waiting!: () => void;
	const entered = new Promise<void>((resolve) => {
		waiting = resolve;
	});
	let recoveries = 0;
	const health = new PostgresHealth({
		probe: async () => undefined,
		recover: async () => {
			recoveries++;
		},
		wait: async () => {
			waiting();
			await new Promise<void>((resolve) => {
				release = resolve;
			});
		},
	});
	const check = assert.rejects(health.check());
	await entered;
	const stop = health.stop();
	release();
	await Promise.all([check, stop]);
	assert.equal(recoveries, 1);
	await assert.rejects(health.check(), /stopped/);
});

test("idle monitoring is serialized and stops with its owner", async () => {
	vi.useFakeTimers();
	let probes = 0;
	const health = new PostgresHealth({
		probe: async () => {
			probes++;
			return { url: "managed", identity: "1" };
		},
		recover: async () => {
			throw new Error("healthy");
		},
	});
	try {
		health.start();
		health.start();
		await vi.advanceTimersByTimeAsync(15_000);
		assert.equal(probes, 3);
		await health.stop();
		await vi.advanceTimersByTimeAsync(10_000);
		assert.equal(probes, 3);
	} finally {
		await health.stop();
		vi.useRealTimers();
	}
});
