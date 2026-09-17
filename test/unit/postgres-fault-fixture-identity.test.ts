import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "vitest";
import { postmasterIdentityChanged } from "../helpers/postgres-process-identity.js";
import { makeTempDirectory, removePathSync, removeTempDirectory, writeTextSync } from "../helpers/runtime.js";

// #3074: shutdown observation must survive pidfile removal and immediate replacement.
test("fault fixture observes the captured postmaster, not its replacement", () => {
	const home = makeTempDirectory("atomic-postmaster-observation-");
	const pidfile = join(home, "postmaster.pid");
	const expected = { pid: 123, started: 456 };
	try {
		writeTextSync(pidfile, "123\nowned-data\n456\n5439\n");
		assert.equal(postmasterIdentityChanged(pidfile, expected), false);
		removePathSync(pidfile);
		assert.equal(postmasterIdentityChanged(pidfile, expected), true, "removal during shutdown is completion");
		writeTextSync(pidfile, "124\nowned-data\n457\n5439\n");
		assert.equal(postmasterIdentityChanged(pidfile, expected), true);
		writeTextSync(pidfile, "123\nowned-data\n457\n5439\n");
		assert.equal(postmasterIdentityChanged(pidfile, expected), true, "PID reuse must compare start identity");
		writeTextSync(pidfile, "124\n");
		assert.equal(postmasterIdentityChanged(pidfile, expected), false, "wait for an incomplete replacement pidfile");
		assert.throws(() => postmasterIdentityChanged(home, expected), /EISDIR|EPERM|EACCES/, "do not hide read errors");
	} finally {
		removeTempDirectory(home);
	}
});
