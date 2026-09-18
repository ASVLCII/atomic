import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "vitest";
import { moduleDir } from "../helpers/runtime.js";

const repoRoot = resolve(moduleDir(import.meta.url), "../..");

test("built public workflow snapshots expose exact routing selection in results and callbacks", () => {
	const root = mkdtempSync(join(tmpdir(), "atomic-built-router-types-"));
	try {
		mkdirSync(join(root, "node_modules", "@bastani"), { recursive: true });
		symlinkSync(join(repoRoot, "packages", "coding-agent"), join(root, "node_modules", "@bastani", "atomic"), "dir");
		writeFileSync(join(root, "package.json"), JSON.stringify({ type: "module" }));
		writeFileSync(
			join(root, "tsconfig.json"),
			JSON.stringify({
				compilerOptions: {
					strict: true,
					noEmit: true,
					skipLibCheck: true,
					target: "ES2022",
					module: "NodeNext",
					moduleResolution: "NodeNext",
				},
				include: ["probe.ts"],
			}),
		);
		writeFileSync(
			join(root, "probe.ts"),
			`
import type { ModelRouterOutput } from "@bastani/atomic";
import type { StageSnapshot, RunResult, RunOpts } from "@bastani/atomic/workflows";
declare const snapshot: StageSnapshot;
declare const result: RunResult;
const selection: ModelRouterOutput | undefined = snapshot.routerSelection;
const resultSelection: ModelRouterOutput | undefined = result.stages[0]?.routerSelection;
type Same<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
const exact: Same<StageSnapshot["routerSelection"], ModelRouterOutput | undefined> = true;
const opts: RunOpts = {
 onStageStart(_runId, stage) { const route: ModelRouterOutput | undefined = stage.routerSelection; void route; },
 onStageEnd(_runId, stage) { const route: ModelRouterOutput | undefined = stage.routerSelection; void route; },
};
void selection; void resultSelection; void exact; void opts;
`,
		);
		try {
			execFileSync("bun", [join(repoRoot, "node_modules", "typescript", "bin", "tsc"), "-p", root], {
				encoding: "utf8",
				stdio: "pipe",
			});
		} catch (error) {
			const failure = error as { stdout?: string; stderr?: string };
			assert.fail([failure.stdout, failure.stderr].join("\n"));
		}
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}, 60_000);
