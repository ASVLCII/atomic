import assert from "node:assert/strict";
import { test } from "vitest";
import { type ManagedResult, RealPostgresHome, reserveListener } from "../helpers/real-postgres.js";
import { sleep } from "../helpers/runtime.js";

const REAL_MANAGED_DBOS_PROCESS_TIMEOUT_MS = 120_000;
type ConsumerResult = Pick<ManagedResult, "metadata"> & { runId: string; completedCalls: number };

// #3072/#3074: both existing production DBOS pools must recover, not newly created pg.Clients.
test(
	"managed DBOS consumers automatically recover their pools and same-ID checkpoints",
	async () => {
		const home = new RealPostgresHome();
		const listener = await reserveListener();
		try {
			const first = home.client(
				listener.port,
				{ ATOMIC_WORKFLOW_ARTIFACT_DIR: `${home.path}/first-artifacts` },
				"managed-dbos-fault-client.ts",
			);
			const second = home.client(
				listener.port,
				{ ATOMIC_WORKFLOW_ARTIFACT_DIR: `${home.path}/second-artifacts` },
				"managed-dbos-fault-client.ts",
			);
			const a = await first.request<ConsumerResult>("warm");
			const b = await second.request<ConsumerResult>("warm");
			assert.notEqual(a.runId, b.runId);
			assert.deepEqual(a.metadata, b.metadata);
			assert.notEqual(a.metadata.server.port, listener.port);
			// A third process only stops this disposable directory, never provisions or connects.
			const fault = home.client(listener.port);
			await fault.request("stop");
			const deadline = Date.now() + 20_000;
			for (;;) {
				const observed = await first.request<Pick<ManagedResult, "metadata">>("metadata");
				if (observed.metadata.server.pid !== a.metadata.server.pid) break;
				assert.ok(Date.now() < deadline, "production health polling did not restart the owned server");
				await sleep(50);
			}
			const [recoveredA, recoveredB] = await Promise.all([
				first.request<ConsumerResult>("resume"),
				second.request<ConsumerResult>("resume"),
			]);
			assert.equal(recoveredA.runId, a.runId);
			assert.equal(recoveredB.runId, b.runId);
			assert.equal(recoveredA.completedCalls, 1);
			assert.equal(recoveredB.completedCalls, 1);
			assert.deepEqual(recoveredA.metadata, recoveredB.metadata, "existing consumers converge on one server");
			assert.equal(recoveredA.metadata.clusterId, a.metadata.clusterId);
			assert.equal(recoveredA.metadata.directoryIdentity, a.metadata.directoryIdentity);
			assert.equal(recoveredA.metadata.server.systemIdentifier, a.metadata.server.systemIdentifier);
			assert.equal(recoveredA.metadata.server.port, a.metadata.server.port);
			assert.notEqual(recoveredA.metadata.server.pid, a.metadata.server.pid);
			assert.deepEqual(await first.request("inspect-peer", b.runId), { persisted: true });
			assert.deepEqual(await second.request("inspect-peer", a.runId), { persisted: true });
		} finally {
			try {
				await home.cleanup();
			} finally {
				await listener.close();
			}
		}
	},
	REAL_MANAGED_DBOS_PROCESS_TIMEOUT_MS,
);
