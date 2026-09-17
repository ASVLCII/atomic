import { execSync, spawn } from "child_process";
import { platform } from "os";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { copyToClipboard } from "../src/utils/clipboard.ts";

const mocks = vi.hoisted(() => {
	return {
		clipboard: {
			setText: vi.fn<(text: string) => Promise<void>>(),
		},
		execSync: vi.fn(),
		spawn: vi.fn(),
		platform: vi.fn<() => NodeJS.Platform>(),
		isWaylandSession: vi.fn<() => boolean>(),
	};
});

vi.mock("../src/utils/clipboard-native.js", () => {
	return {
		clipboard: mocks.clipboard,
	};
});

vi.mock("child_process", () => {
	return {
		execSync: mocks.execSync,
		spawn: mocks.spawn,
	};
});

vi.mock("os", () => {
	return {
		platform: mocks.platform,
	};
});

vi.mock("../src/utils/clipboard-image.js", () => {
	return {
		isWaylandSession: mocks.isWaylandSession,
	};
});

const mockedExecSync = vi.mocked(execSync);
const mockedSpawn = vi.mocked(spawn);
const mockedPlatform = vi.mocked(platform);

let originalWrite: typeof process.stdout.write;
let stdoutWrites: string[];
let nativeResolved = false;

function osc52Writes(): string[] {
	return stdoutWrites.filter((write) => write.startsWith("\x1b]52;c;"));
}

function mockWlCopyExit(code: number): void {
	const child = {
		once(event: string, listener: (value: number | null) => void) {
			if (event === "close") queueMicrotask(() => listener(code));
			return child;
		},
		stdin: {
			on() {
				return child.stdin;
			},
			end: vi.fn(),
		},
	};
	mockedSpawn.mockReturnValue(child as unknown as ReturnType<typeof spawn>);
}

beforeEach(() => {
	vi.unstubAllEnvs();
	vi.stubEnv("SSH_CONNECTION", "");
	vi.stubEnv("SSH_CLIENT", "");
	vi.stubEnv("MOSH_CONNECTION", "");
	vi.stubEnv("TERMUX_VERSION", "");
	vi.stubEnv("WAYLAND_DISPLAY", "");
	vi.stubEnv("DISPLAY", "");
	stdoutWrites = [];
	nativeResolved = false;
	mocks.clipboard.setText.mockReset();
	mocks.execSync.mockReset();
	mocks.spawn.mockReset();
	mocks.platform.mockReset();
	mocks.isWaylandSession.mockReset();
	mockedPlatform.mockReturnValue("darwin");
	mocks.isWaylandSession.mockReturnValue(false);
	mocks.clipboard.setText.mockImplementation(async () => {
		await new Promise((resolve) => setTimeout(resolve, 1));
		nativeResolved = true;
	});
	originalWrite = process.stdout.write.bind(process.stdout);
	process.stdout.write = ((...args: Parameters<typeof process.stdout.write>) => {
		const [chunk] = args;
		if (typeof chunk === "string" && chunk.startsWith("\x1b]52;c;")) {
			stdoutWrites.push(chunk);
			return true;
		}
		return originalWrite(...args);
	}) as typeof process.stdout.write;
});

afterEach(() => {
	process.stdout.write = originalWrite;
	vi.unstubAllEnvs();
});

describe("copyToClipboard", () => {
	test("local native success skips OSC 52 and shell fallbacks", async () => {
		await copyToClipboard("hello");

		expect(mocks.clipboard.setText).toHaveBeenCalledWith("hello");
		expect(osc52Writes()).toHaveLength(0);
		expect(mockedExecSync).not.toHaveBeenCalled();
		expect(mockedSpawn).not.toHaveBeenCalled();
	});

	test("remote native success emits OSC 52 after native write", async () => {
		vi.stubEnv("SSH_CONNECTION", "client server");
		mocks.clipboard.setText.mockImplementation(async () => {
			await new Promise((resolve) => setTimeout(resolve, 1));
			expect(osc52Writes()).toHaveLength(0);
			nativeResolved = true;
		});

		await copyToClipboard("hello");

		expect(nativeResolved).toBe(true);
		expect(osc52Writes()).toHaveLength(1);
		expect(mockedExecSync).not.toHaveBeenCalled();
	});

	test("local shell fallback success skips OSC 52", async () => {
		mocks.clipboard.setText.mockRejectedValue(new Error("native failed"));
		mockedExecSync.mockReturnValue(Buffer.alloc(0));

		await copyToClipboard("hello");

		expect(mockedExecSync).toHaveBeenCalledWith("pbcopy", {
			input: "hello",
			stdio: ["pipe", "ignore", "ignore"],
			timeout: 5000,
			env: expect.objectContaining({ AI_AGENT: "atomic" }),
		});
		expect(osc52Writes()).toHaveLength(0);
	});

	test.each(["SSH_CONNECTION", "SSH_CLIENT", "MOSH_CONNECTION"])("remote %s retains OSC 52 fallback", async (key) => {
		vi.stubEnv(key, "remote");
		mocks.clipboard.setText.mockRejectedValue(new Error("native failed"));
		mockedExecSync.mockImplementation(() => {
			throw new Error("pbcopy failed");
		});

		await copyToClipboard("hello");

		expect(osc52Writes()).toHaveLength(1);
	});

	test("does not emit oversized OSC 52 payloads", async () => {
		vi.stubEnv("SSH_CONNECTION", "remote");
		mocks.clipboard.setText.mockRejectedValue(new Error("native failed"));
		mockedExecSync.mockImplementation(() => {
			throw new Error("pbcopy failed");
		});

		await expect(copyToClipboard("x".repeat(80_000))).rejects.toThrow("Clipboard unavailable");
		expect(osc52Writes()).toHaveLength(0);
	});

	test("awaits successful wl-copy before reporting Wayland success", async () => {
		mockedPlatform.mockReturnValue("linux");
		mocks.isWaylandSession.mockReturnValue(true);
		vi.stubEnv("WAYLAND_DISPLAY", "wayland-1");
		mockWlCopyExit(0);
		mockedExecSync.mockReturnValue(Buffer.alloc(0));

		await copyToClipboard("hello");

		expect(mockedSpawn).toHaveBeenCalledWith("wl-copy", [], {
			stdio: ["pipe", "ignore", "ignore"],
			env: expect.objectContaining({ AI_AGENT: "atomic" }),
		});
		expect(mockedExecSync.mock.calls.map(([command]) => command)).toEqual(["which wl-copy"]);
		expect(osc52Writes()).toHaveLength(0);
	});

	test("falls through to X11 when wl-copy exits unsuccessfully", async () => {
		mockedPlatform.mockReturnValue("linux");
		mocks.isWaylandSession.mockReturnValue(true);
		vi.stubEnv("WAYLAND_DISPLAY", "wayland-1");
		vi.stubEnv("DISPLAY", ":0");
		mockWlCopyExit(1);
		mockedExecSync.mockReturnValue(Buffer.alloc(0));

		await copyToClipboard("hello");

		expect(mockedExecSync.mock.calls.map(([command]) => command)).toEqual([
			"which wl-copy",
			"xclip -selection clipboard",
		]);
		expect(osc52Writes()).toHaveLength(0);
	});

	test("rejects failed local wl-copy without emitting OSC 52", async () => {
		mockedPlatform.mockReturnValue("linux");
		mocks.isWaylandSession.mockReturnValue(true);
		vi.stubEnv("WAYLAND_DISPLAY", "wayland-1");
		mockWlCopyExit(1);
		mockedExecSync.mockReturnValue(Buffer.alloc(0));

		await expect(copyToClipboard("hello")).rejects.toThrow(
			"Clipboard unavailable: install `wl-clipboard` (`wl-copy`) or check Wayland access",
		);
		expect(osc52Writes()).toHaveLength(0);
	});

	test.each([
		["darwin", "", "", "", "Clipboard unavailable"],
		["win32", "", "", "", "Clipboard unavailable"],
		["linux", "1", "wayland-1", ":0", "Clipboard unavailable: install the Termux:API app and `termux-api` package"],
		[
			"linux",
			"",
			"wayland-1",
			":0",
			"Clipboard unavailable: install `wl-clipboard` (`wl-copy`) or check Wayland access",
		],
		["linux", "", "", ":0", "Clipboard unavailable: install `xclip` or `xsel`, or check X11 access"],
		["linux", "", "", "", "Clipboard unavailable: no Wayland or X11 display detected"],
	] as const)(
		"local %s failure reports backend guidance (%s %s %s)",
		async (os, termux, wayland, display, message) => {
			mockedPlatform.mockReturnValue(os);
			vi.stubEnv("TERMUX_VERSION", termux);
			vi.stubEnv("WAYLAND_DISPLAY", wayland);
			vi.stubEnv("DISPLAY", display);
			mocks.isWaylandSession.mockReturnValue(Boolean(wayland));
			mocks.clipboard.setText.mockRejectedValue(new Error("native failed"));
			mockedExecSync.mockImplementation(() => {
				throw new Error("backend failed");
			});
			await expect(copyToClipboard("hello")).rejects.toThrow(message);
			expect(osc52Writes()).toHaveLength(0);
		},
	);
});
