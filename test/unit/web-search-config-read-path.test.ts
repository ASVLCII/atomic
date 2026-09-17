import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { getUserConfigPaths } from "@bastani/atomic";
import { afterAll, beforeEach, test } from "vitest";
import type { WebSearchConfig } from "../../packages/web-access/web-search-config.js";

// web-search-config resolves its config paths from the home directory while
// the module loads, so the temporary home must be in place before the dynamic
// import below; a static import would be hoisted above it. The type-only
// import above is erased before emit and loads nothing.
const previousEnv = { HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE };
const home = mkdtempSync(join(tmpdir(), "web-search-config-home-"));
process.env.HOME = home;
process.env.USERPROFILE = home;

const [atomicConfigPath, legacyConfigPath] = getUserConfigPaths("web-search.json");
assert.ok(legacyConfigPath, "expected a legacy config path beside the Atomic one");

// Every test shares this one module instance on purpose: the fix is that the
// readable path is resolved per call, so the scenarios below differ only in
// which files exist on disk when loadConfig runs — never in module state.
const { loadConfig, loadConfigForExtensionInit, saveConfig } = await import(
	"../../packages/web-access/web-search-config.js"
);

function writeConfig(path: string, contents: WebSearchConfig | string): void {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, typeof contents === "string" ? contents : `${JSON.stringify(contents, null, 2)}\n`);
}

beforeEach(() => {
	rmSync(atomicConfigPath, { force: true });
	rmSync(legacyConfigPath, { force: true });
});

afterAll(() => {
	for (const [key, value] of Object.entries(previousEnv)) {
		if (value === undefined) delete process.env[key];
		else process.env[key] = value;
	}
	rmSync(home, { recursive: true, force: true });
});

// Regression for #3058.
test("loadConfig reads the legacy Pi config when only the legacy file exists", () => {
	writeConfig(legacyConfigPath, { provider: "exa" });

	assert.equal(existsSync(atomicConfigPath), false);
	assert.deepEqual(loadConfig(), { provider: "exa" });
});

// Regression for #3058.
test("loadConfig reads the Atomic config when only the Atomic file exists", () => {
	writeConfig(atomicConfigPath, { provider: "perplexity" });

	assert.equal(existsSync(legacyConfigPath), false);
	assert.deepEqual(loadConfig(), { provider: "perplexity" });
});

// Regression for #3058.
test("loadConfig prefers the Atomic config over the legacy Pi config when both files exist", () => {
	writeConfig(legacyConfigPath, { provider: "exa", workflow: "none" });
	writeConfig(atomicConfigPath, { provider: "gemini" });

	// Atomic-first precedence reads one file whole; the legacy file is ignored
	// rather than merged underneath it.
	assert.deepEqual(loadConfig(), { provider: "gemini" });
});

// Regression for #3058.
test("loadConfig follows a config saved to the Atomic path after a legacy-only start", () => {
	writeConfig(legacyConfigPath, { provider: "exa" });
	assert.equal(existsSync(atomicConfigPath), false);
	assert.deepEqual(loadConfig(), { provider: "exa" });

	// The same save /curator on performs (index-heavy.ts), without restarting
	// the process or re-importing the module.
	saveConfig({ workflow: "summary-review" });

	assert.deepEqual(JSON.parse(readFileSync(atomicConfigPath, "utf-8")), {
		provider: "exa",
		workflow: "summary-review",
	});
	assert.deepEqual(JSON.parse(readFileSync(legacyConfigPath, "utf-8")), { provider: "exa" });
	assert.deepEqual(loadConfig(), { provider: "exa", workflow: "summary-review" });
});

// Regression for #3058.
test("saveConfig merges into the readable config and keeps writing the Atomic path", () => {
	writeConfig(atomicConfigPath, { provider: "exa", shortcuts: { curate: "ctrl+shift+s" } });

	saveConfig({ workflow: "summary-review" });
	saveConfig({ provider: "gemini" });

	assert.deepEqual(loadConfig(), {
		provider: "gemini",
		shortcuts: { curate: "ctrl+shift+s" },
		workflow: "summary-review",
	});
	assert.equal(existsSync(legacyConfigPath), false);
});

// Regression for #3058.
test("loadConfig returns defaults when neither config file exists", () => {
	assert.equal(existsSync(atomicConfigPath), false);
	assert.equal(existsSync(legacyConfigPath), false);
	assert.deepEqual(loadConfig(), {});
});

// Regression for #3058.
test("malformed config JSON still throws from loadConfig and is swallowed by the extension init path", () => {
	writeConfig(atomicConfigPath, "{ not json");

	assert.throws(
		() => loadConfig(),
		(err: unknown) => err instanceof Error && err.message.startsWith(`Failed to parse ${atomicConfigPath}: `),
	);

	const errors: string[] = [];
	const previousConsoleError = console.error;
	console.error = (message: string) => {
		errors.push(message);
	};
	try {
		assert.deepEqual(loadConfigForExtensionInit(), {});
	} finally {
		console.error = previousConsoleError;
	}
	assert.equal(errors.length, 1);
	assert.ok(errors[0]?.startsWith(`[pi-web-access] Failed to parse ${atomicConfigPath}: `));
});
