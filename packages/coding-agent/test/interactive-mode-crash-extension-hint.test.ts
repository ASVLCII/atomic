import { describe, expect, test } from "vitest";
import { APP_NAME } from "../src/config.ts";
import { formatCrashExtensionHint } from "../src/modes/interactive/interactive-mode-helpers.ts";

describe("InteractiveMode crash extension hints", () => {
	test("identifies extensions with frames in a crash stack", () => {
		expect(formatCrashExtensionHint(["npm:pi-observational-memory"])).toBe(
			`A stack frame came from loaded extension \`npm:pi-observational-memory\`, which may be involved. Try disabling it with \`${APP_NAME} config\`, or run \`${APP_NAME} -ne\` to confirm.`,
		);
		expect(formatCrashExtensionHint(undefined)).toBeUndefined();
	});

	test("lists several matching extensions", () => {
		expect(formatCrashExtensionHint(["npm:a", "npm:b", "/plugins/c.ts"])).toBe(
			`A stack frame came from loaded extensions \`npm:a\`, \`npm:b\`, and \`/plugins/c.ts\`, which may be involved. Try disabling them with \`${APP_NAME} config\`, or run \`${APP_NAME} -ne\` to confirm.`,
		);
	});
});
