import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "vitest";
import { awaitFixtureBrokerExit, withoutSqliteExperimentalWarning } from "../fixtures/sdk-host-fixture-support.mjs";
import { spawnProcess } from "../helpers/runtime.js";

// #3111: only Node's exact SQLite notice is exempt, never SDK diagnostics.
test("quiet-host assertion retains operational errors and unrelated warnings", () => {
	const warning =
		"(node:123) ExperimentalWarning: SQLite is an experimental feature and might change at any time\n(Use `node --trace-warnings ...` to show where the warning was created)\n";
	assert.equal(withoutSqliteExperimentalWarning(warning), "");
	assert.equal(withoutSqliteExperimentalWarning(warning.replaceAll("\n", "\r\n")), "");
	const diagnostic = "Failed to load extension\n(node:123) ExperimentalWarning: something else\n";
	assert.equal(withoutSqliteExperimentalWarning(diagnostic + warning), diagnostic);
});

test("fixture broker cleanup awaits process exit before deleting its directory", async () => {
	const root = mkdtempSync(join(tmpdir(), "atomic-fixture-broker-"));
	const child = spawnProcess([process.execPath, "-e", "setTimeout(() => {}, 100)"], {
		stdout: "ignore",
		stderr: "ignore",
	});
	try {
		const pid = child.pid;
		assert.ok(pid);
		mkdirSync(join(root, "intercom"));
		writeFileSync(join(root, "intercom", "broker.pid"), String(child.pid));
		await awaitFixtureBrokerExit(root);
		assert.throws(() => process.kill(pid, 0));
		assert.equal(await child.exited, 0, "cleanup must not signal a PID read from disk");
	} finally {
		child.kill("SIGKILL");
		await child.exited;
		rmSync(root, { recursive: true, force: true });
	}
});
