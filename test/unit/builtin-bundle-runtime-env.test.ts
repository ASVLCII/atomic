import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "vitest";
import { INSTALLED_EXTENSION_ENTRIES } from "../../packages/coding-agent/src/core/builtin-install-layout.js";
import { fileExistsSync, moduleDir, readTextSync } from "../helpers/runtime.js";

const root = join(moduleDir(import.meta.url), "../..");
const distBuiltinRoot = join(root, "packages", "coding-agent", "dist", "builtin");
const buildCommand = "npm --workspace=@bastani/atomic run build";

function requireBuiltPath(path: string): void {
	assert.ok(fileExistsSync(path), `Missing built artifact ${path}. Run \`${buildCommand}\` before this test.`);
}

// Bun.build folds `process.env.NODE_ENV` into the value present in the build
// environment. The workflows extension reads it at runtime to choose the test-host
// stub session over a real SDK stage session, so a bundle built under NODE_ENV=test
// (vitest exports it) ships workflow stages that never create a real session and
// never issue a provider request. The bundler must keep the read literal.
test("shipped workflows extension bundle decides test-host stubbing at runtime, not at bundle time", () => {
	const bundle = join(distBuiltinRoot, "workflows", INSTALLED_EXTENSION_ENTRIES.workflows);
	requireBuiltPath(bundle);
	const source = readTextSync(bundle, "utf8");
	assert.match(
		source,
		/process\.env\.NODE_TEST_CONTEXT !== void 0 \|\| process\.env\.NODE_ENV === "test"|process\.env\.NODE_TEST_CONTEXT !== undefined \|\| process\.env\.NODE_ENV === "test"/u,
		"isTestContext() must read process.env.NODE_ENV at runtime in the shipped bundle",
	);
	assert.doesNotMatch(
		source,
		/process\.env\.NODE_TEST_CONTEXT !== (?:void 0|undefined) \|\| (?:true|false)\b/u,
		"the bundler folded process.env.NODE_ENV into a constant taken from the build environment",
	);
});
