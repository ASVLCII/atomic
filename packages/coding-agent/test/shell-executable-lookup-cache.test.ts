import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const spawnSync = vi.hoisted(() => vi.fn());

vi.mock("child_process", async (importOriginal) => {
	const actual = await importOriginal<typeof import("child_process")>();
	return { ...actual, spawnSync };
});

const { getPowerShellConfig } = await import("../src/utils/shell.ts");

const platform = Object.getOwnPropertyDescriptor(process, "platform")!;
const originalPath = process.env.PATH;

describe("PowerShell executable lookup", () => {
	beforeEach(() => {
		Object.defineProperty(process, "platform", { configurable: true, value: "win32" });
		spawnSync.mockReset();
		spawnSync.mockReturnValue({ status: 0, stdout: `${process.execPath}\r\n` });
	});

	afterEach(() => {
		Object.defineProperty(process, "platform", platform);
		process.env.PATH = originalPath;
		vi.useRealTimers();
	});

	it("resolves PowerShell with one synchronous PATH lookup per PATH value", () => {
		process.env.PATH = "C:\\first-lookup-path";
		expect(getPowerShellConfig().shell).toBe(process.execPath);
		expect(getPowerShellConfig().shell).toBe(process.execPath);
		expect(getPowerShellConfig().shell).toBe(process.execPath);
		expect(spawnSync).toHaveBeenCalledOnce();
	});

	it("looks PowerShell up again after PATH changes", () => {
		process.env.PATH = "C:\\second-lookup-path";
		getPowerShellConfig();
		process.env.PATH = "C:\\third-lookup-path";
		getPowerShellConfig();
		expect(spawnSync).toHaveBeenCalledTimes(2);
	});

	it("finds PowerShell installed after a missed lookup without a PATH change", () => {
		vi.useFakeTimers();
		process.env.PATH = "C:\\install-later-path";
		spawnSync.mockReturnValue({ status: 1, stdout: "" });
		expect(() => getPowerShellConfig()).toThrow(/No PowerShell executable found/);
		const missedLookups = spawnSync.mock.calls.length;
		expect(() => getPowerShellConfig()).toThrow(/No PowerShell executable found/);
		expect(spawnSync).toHaveBeenCalledTimes(missedLookups);

		spawnSync.mockReturnValue({ status: 0, stdout: `${process.execPath}\r\n` });
		vi.advanceTimersByTime(30_000);
		expect(getPowerShellConfig().shell).toBe(process.execPath);
	});
});
