import { readTextSync } from "./runtime.js";

/** Observe the captured server only; its replacement may already have a pidfile. */
export function postmasterIdentityChanged(pidfile: string, expected: { pid: number; started: number }): boolean {
	let identity: string[];
	try {
		// One read avoids exists/stat/read races as PostgreSQL removes its pidfile.
		identity = readTextSync(pidfile, "utf8").split(/\r?\n/);
	} catch (error) {
		if (
			error instanceof Error &&
			"code" in error &&
			error.code === "ENOENT" &&
			"path" in error &&
			error.path === pidfile
		)
			return true;
		throw error;
	}
	const pid = Number(identity[0]);
	const started = Number(identity[2]);
	return (
		Number.isSafeInteger(pid) &&
		pid > 0 &&
		Number.isSafeInteger(started) &&
		started > 0 &&
		(pid !== expected.pid || started !== expected.started)
	);
}
