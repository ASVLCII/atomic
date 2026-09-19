import assert from "node:assert/strict";
import { resolve } from "node:path";
import { test } from "vitest";
import { fileExists, moduleDir, readJson } from "../helpers/runtime.js";

const root = resolve(moduleDir(import.meta.url), "../..");

// #3105 / PR #3111: static-checks runs before Atomic's published workflow files are built.
test("public workflow fixtures have source mappings matching published declarations", async () => {
	const config = await readJson<{ compilerOptions: { paths: Record<string, string[]> } }>(
		resolve(root, "tsconfig.json"),
	);
	const manifest = await readJson<{ exports: Record<string, { types: string }> }>(
		resolve(root, "packages/coding-agent/package.json"),
	);
	for (const subpath of ["workflows", "workflows/builtin", "workflows/builtin/*"]) {
		const published = manifest.exports[`./${subpath}`].types;
		const source = published.replace("./dist/builtin/workflows/", "./packages/workflows/").replace(/\.d\.ts$/, ".ts");
		const mapping = config.compilerOptions.paths[`@bastani/atomic/${subpath}`];
		// Wildcard source mappings can omit the extension; TypeScript supplies it.
		assert.deepEqual(mapping, [subpath.endsWith("*") ? source.replace(/\.ts$/, "") : source]);
		assert.equal(await fileExists(resolve(root, source.replace("*", "open-claude-design"))), true);
	}
	assert.equal(config.compilerOptions.paths["@bastani/atomic/workflows/*"], undefined);
});
