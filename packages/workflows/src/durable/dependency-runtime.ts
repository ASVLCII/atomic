import { execFile } from "node:child_process";
import { loadEmbeddedPostgresBinaries } from "./dbos-embedded-postgres.js";

/** Execute only version probes. Never repair links, permissions or cluster data. */
export async function inspectPostgresRuntime(): Promise<{ executable: string; version: string }> {
	const binaries = await loadEmbeddedPostgresBinaries({ readOnly: true });
	let version = "";
	for (const binary of [binaries.postgres, binaries.pg_ctl, binaries.initdb]) {
		const output = await new Promise<string>((resolve, reject) => {
			execFile(
				binary,
				["--version"],
				{ timeout: 1000, maxBuffer: 16_384, windowsHide: true },
				(error, stdout, stderr) => {
					if (error)
						reject(new Error(`PostgreSQL runtime probe failed for ${binary}: ${stderr.trim() || error.message}`));
					else resolve(stdout.trim());
				},
			);
		});
		if (!/PostgreSQL\)?\s+18\./.test(output))
			throw new Error(`Expected PostgreSQL 18 runtime at ${binary}; received ${output}.`);
		if (binary === binaries.postgres) version = output;
	}
	return { executable: binaries.postgres, version };
}
