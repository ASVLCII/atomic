import { spawn } from "node:child_process";
import { describe, expect, it } from "vitest";
import { isWindowsProcessAlive } from "../src/utils/child-process.ts";

describe("isWindowsProcessAlive", () => {
	it("reports a running process as alive", () => {
		expect(isWindowsProcessAlive(process.pid)).toBe(true);
	});

	it("reports an exited child as gone", async () => {
		const child = spawn(process.execPath, ["-e", ""], { stdio: "ignore", windowsHide: true });
		await new Promise<void>((resolve) => child.once("exit", () => resolve()));
		expect(child.pid).toBeTypeOf("number");
		expect(isWindowsProcessAlive(child.pid as number)).toBe(false);
	});
});
