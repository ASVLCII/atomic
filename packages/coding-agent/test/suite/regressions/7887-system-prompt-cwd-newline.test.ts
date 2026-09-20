import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "../../../src/core/system-prompt.ts";

/**
 * The working directory is the last structured prompt section. Without a trailing
 * newline the next block a provider concatenates lands on the same line as the
 * closing cwd tag.
 */
describe("regression #7887: the system prompt ends with a newline after the cwd", () => {
	const cwd = process.cwd();
	const promptCwd = cwd.replace(/\\/g, "/");

	it("terminates the default prompt after the working directory", () => {
		const prompt = buildSystemPrompt({ selectedTools: [], contextFiles: [], skills: [], cwd });

		expect(prompt).toContain(`Current working directory: ${promptCwd}`);
		expect(prompt.endsWith(`\n<cwd>\nCurrent working directory: ${promptCwd}\n</cwd>`)).toBe(true);
	});

	it("terminates a custom prompt after the working directory", () => {
		const prompt = buildSystemPrompt({
			customPrompt: "You are a custom assistant.",
			contextFiles: [],
			skills: [],
			cwd,
		});

		expect(prompt).toContain("You are a custom assistant.");
		expect(prompt.endsWith(`\n<cwd>\nCurrent working directory: ${promptCwd}\n</cwd>`)).toBe(true);
	});

	it("keeps exactly one trailing newline", () => {
		const prompt = buildSystemPrompt({ selectedTools: [], contextFiles: [], skills: [], cwd });

		expect(prompt.endsWith("\n\n")).toBe(false);
	});
});
