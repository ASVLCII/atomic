import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, vi } from "vitest";
import { withBuiltinResourceLoader } from "../src/core/builtin-resource-loader.ts";
import { DefaultResourceLoader } from "../src/core/resource-loader.ts";
import { SettingsManager } from "../src/core/settings-manager.ts";
import { Theme, type ThemeBg, type ThemeColor } from "../src/modes/interactive/theme/theme.ts";

// #3105: exercise the real composition wrapper with injected Windows path semantics,
// not a claim of native Windows execution. Other filesystem operations stay local.
vi.mock("node:path", async (original) => {
	const path = await original<typeof import("node:path")>();
	return { ...path, relative: path.win32.relative, sep: path.win32.sep, isAbsolute: path.win32.isAbsolute };
});
vi.mock("../src/core/builtin-packages.ts", () => {
	const locations = [{ packageName: "@bastani/mcp", distDirName: "mcp", packageDir: "C:\\atomic\\builtin\\mcp" }];
	return {
		getBuiltinPackageLocations: (required: boolean) => (required ? [] : locations),
		getAllBuiltinPackageLocations: () => locations,
		getMandatoryBuiltinExtensionPaths: () => [],
	};
});

test("disabled Windows builtin preserves caller extensions and resources on other drives", async () => {
	const cwd = mkdtempSync(join(tmpdir(), "atomic-win32-composition-"));
	try {
		const loader = new DefaultResourceLoader({
			cwd,
			agentDir: cwd,
			settingsManager: SettingsManager.inMemory(),
			noExtensions: true,
			noContextFiles: true,
			extensionFactories: [() => {}],
		});
		await loader.reload();
		const paths = [
			"C:\\atomic\\builtin\\mcp\\index.ts",
			"D:\\caller\\custom.ts",
			"C:\\caller\\custom.ts",
			"C:\\atomic\\builtin\\mcp-other\\index.ts",
		];
		const extensions = paths.map((resolvedPath) => ({ ...loader.getExtensions().extensions[0], resolvedPath }));
		const result = { ...loader.getExtensions(), extensions };
		vi.spyOn(loader, "getExtensions").mockReturnValue(result);
		const skills = paths.map((filePath, i) => ({
			name: `skill-${i}`,
			description: "caller",
			filePath,
			baseDir: filePath,
			source: "user",
			disableModelInvocation: false,
		}));
		const prompts = paths.map((filePath, i) => ({
			name: `prompt-${i}`,
			description: "caller",
			filePath,
			content: "caller",
			source: "user",
		}));
		const themes = paths.map(
			(sourcePath) =>
				new Theme(
					{ text: "#ffffff" } as Record<ThemeColor, string>,
					{ selectedBg: "#000000" } as Record<ThemeBg, string>,
					"truecolor",
					{ sourcePath },
				),
		);
		vi.spyOn(loader, "getThemes").mockReturnValue({ themes, diagnostics: [] });
		vi.spyOn(loader, "getSkills").mockReturnValue({ skills, diagnostics: [] });
		vi.spyOn(loader, "getPrompts").mockReturnValue({ prompts, diagnostics: [] });
		const composed = await withBuiltinResourceLoader(loader, cwd, cwd, { mcp: false });
		for (let generation = 0; generation < 2; generation++) {
			assert.deepEqual(composed.getExtensions().extensions, extensions.slice(1));
			assert.deepEqual(composed.getSkills().skills, skills.slice(1));
			assert.deepEqual(composed.getPrompts().prompts, prompts.slice(1));
			assert.deepEqual(composed.getThemes().themes, themes.slice(1));
			assert.equal(loader.getExtensions().extensions, extensions);
			assert.equal(loader.getSkills().skills, skills);
			assert.equal(loader.getPrompts().prompts, prompts);
			assert.equal(loader.getThemes().themes, themes);
			if (generation === 0) await composed.reload();
		}
	} finally {
		vi.restoreAllMocks();
		rmSync(cwd, { recursive: true, force: true });
	}
});
