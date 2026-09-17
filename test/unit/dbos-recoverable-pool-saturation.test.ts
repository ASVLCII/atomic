import assert from "node:assert/strict";
import { getPGClientConfig } from "@dbos-inc/dbos-sdk/datasource";
import { Client, Pool, type PoolClient } from "pg";
import { test, vi } from "vitest";
import { createRecoverablePostgresPool } from "../../packages/workflows/src/durable/dbos-recoverable-pool.js";

const url = "postgresql://fixture:unused@127.0.0.1:1/isolated?connect_timeout=1&sslmode=disable";

// Only the socket boundary is replaced: pg-pool owns queueing, timeouts and releases.
class SocketlessClient extends Client {
	destroyed = false;
	override connect(): Promise<Client>;
	override connect(callback: (error: Error | null, client: Client) => void): void;
	override connect(callback?: (error: Error | null, client: Client) => void): Promise<Client> | undefined {
		if (callback) queueMicrotask(() => callback(null, this));
		else return Promise.resolve(this);
	}
	override end(): Promise<void>;
	override end(callback: () => void): void;
	override end(callback?: () => void): Promise<void> | undefined {
		this.destroyed = true;
		if (callback) queueMicrotask(callback);
		else return Promise.resolve();
	}
	async roundTrip(): Promise<number> {
		assert.equal(this.destroyed, false, "healthy checkout was destroyed");
		return 1;
	}
}

// #3074 R1: queue admission failure is not evidence of database loss.
for (const mode of ["promise", "callback"] as const) {
	test(`real pg-pool ${mode} saturation preserves healthy checkouts and health`, async () => {
		const onConnectionError = vi.fn();
		const createPool = vi.fn(() => new Pool({ ...getPGClientConfig(url), Client: SocketlessClient }));
		const { pool } = createRecoverablePostgresPool(url, { createPool, onConnectionError });
		const held: PoolClient[] = [];
		const consumerErrors: Error[] = [];
		try {
			for (let index = 0; index < 10; index++) {
				const client = await pool.connect();
				client.on("error", (error) => consumerErrors.push(error));
				held.push(client);
			}
			assert.equal(pool.totalCount, 10);
			const pending =
				mode === "promise"
					? pool.connect()
					: new Promise<PoolClient>((resolve, reject) => {
							pool.connect((error, client, done) => {
								if (error) {
									assert.equal(client, undefined);
									done();
									reject(error);
								} else resolve(client!);
							});
						});
			assert.equal(pool.waitingCount, 1);
			await assert.rejects(pending, /^Error: timeout exceeded when trying to connect$/);
			assert.equal(onConnectionError.mock.calls.length, 0, "saturation must not invalidate managed health");
			assert.deepEqual(consumerErrors, []);
			assert.equal(pool.totalCount, 10);
			assert.equal(pool.waitingCount, 0);
			for (const client of held) {
				assert.ok(client instanceof SocketlessClient);
				assert.equal(await client.roundTrip(), 1);
			}
			const first = held.shift()!;
			first.release();
			const next = await pool.connect();
			held.push(next);
			assert.equal(next, first, "healthy physical connection remains reusable");
			assert.equal(createPool.mock.calls.length, 1);
		} finally {
			for (const client of held) client.release();
			await pool.end();
		}
	});
}

// #3074 R1: server capacity refusal affects only the refused acquisition.
for (const mode of ["promise", "callback"] as const) {
	test(`real pg-pool ${mode} SQLSTATE 53300 preserves healthy checkouts and health`, async () => {
		const refusal = Object.assign(new Error("sorry, too many clients already"), { code: "53300" });
		let attempts = 0;
		class CapacityClient extends SocketlessClient {
			override connect(): Promise<Client>;
			override connect(callback: (error: Error | null, client: Client) => void): void;
			override connect(callback?: (error: Error | null, client: Client) => void): Promise<Client> | undefined {
				const error = attempts++ === 0 ? null : refusal;
				if (callback) queueMicrotask(() => callback(error, this));
				else return error === null ? Promise.resolve(this) : Promise.reject(error);
			}
		}
		const onConnectionError = vi.fn();
		const createPool = vi.fn(() => new Pool({ ...getPGClientConfig(url), Client: CapacityClient }));
		const { pool } = createRecoverablePostgresPool(url, { createPool, onConnectionError });
		const consumerErrors: Error[] = [];
		pool.on("error", (error) => consumerErrors.push(error));
		const held = await pool.connect();
		held.on("error", (error) => consumerErrors.push(error));
		try {
			const pending =
				mode === "promise"
					? pool.connect()
					: new Promise<PoolClient>((resolve, reject) => {
							pool.connect((error, client, done) => {
								if (error) {
									assert.equal(client, undefined);
									done();
									reject(error);
								} else resolve(client!);
							});
						});
			await assert.rejects(pending, (error) => error === refusal);
			assert.ok(held instanceof SocketlessClient);
			assert.equal(await held.roundTrip(), 1);
			assert.deepEqual(consumerErrors, []);
			assert.equal(onConnectionError.mock.calls.length, 0, "refusal must not invalidate managed health");
			assert.equal(pool.totalCount, 1);
			held.release();
			const next = await pool.connect();
			try {
				assert.equal(next, held, "healthy physical connection remains reusable");
				assert.equal(createPool.mock.calls.length, 1, "refusal must not rotate the pool");
			} finally {
				next.release();
			}
		} finally {
			held.release();
			await pool.end();
		}
	});
}

// #3074: the admission exception must not mask confirmed socket loss.
test("real pg-pool idle socket loss invalidates health, evicts checkouts and reconnects", async () => {
	const onConnectionError = vi.fn();
	const createPool = vi.fn(() => new Pool({ ...getPGClientConfig(url), Client: SocketlessClient }));
	const { pool } = createRecoverablePostgresPool(url, { createPool, onConnectionError });
	const held = await pool.connect();
	const idle = await pool.connect();
	const consumerError = vi.fn();
	held.on("error", consumerError);
	try {
		idle.release();
		const loss = Object.assign(new Error("Connection terminated unexpectedly"), { code: "ECONNRESET" });
		idle.emit("error", loss);
		assert.deepEqual(onConnectionError.mock.calls, [[loss]]);
		assert.equal(consumerError.mock.calls.length, 1);
		assert.ok(held instanceof SocketlessClient);
		assert.equal(held.destroyed, true);
		const next = await pool.connect();
		assert.notEqual(next, held);
		assert.ok(next instanceof SocketlessClient);
		assert.equal(await next.roundTrip(), 1);
		next.release();
		assert.equal(createPool.mock.calls.length, 2);
	} finally {
		held.release();
		await pool.end();
	}
});
