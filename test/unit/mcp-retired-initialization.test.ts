import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, vi } from "vitest";
import {
	createAgentSession,
	DefaultResourceLoader,
	SessionManager,
	SettingsManager,
} from "../../packages/coding-agent/src/index.ts";
import mcp from "../../packages/mcp/index.ts";

const fixture = vi.hoisted(() => ({ initialize: async (): Promise<unknown> => undefined }));
vi.mock("../../packages/mcp/init.js", () => ({
	initializeMcp: () => fixture.initialize(),
	updateStatusBar() {},
	flushMetadataCache() {},
}));

// #3105: public disposal must distinguish cancellation from failed candidate cleanup.
test.each([false, true])("retired MCP initialization cleanup failure=%s", async (fail) => {
	const cwd = mkdtempSync(join(tmpdir(), "sdk-retired-mcp-"));
	// #3105: this fixture deliberately requests initialization during startup.
	writeFileSync(
		join(cwd, ".mcp.json"),
		JSON.stringify({ mcpServers: { fixture: { command: "fixture", lifecycle: "eager" } } }),
	);
	const entered = Promise.withResolvers<void>();
	const release = Promise.withResolvers<void>();
	let active = 0;
	let attempts = 0;
	fixture.initialize = async () => {
		entered.resolve();
		await release.promise;
		active++;
		return {
			config: { mcpServers: {} },
			toolMetadata: new Map(),
			failureTracker: new Map(),
			uiServer: null,
			lifecycle: {
				async gracefulShutdown() {
					attempts++;
					if (fail) throw new Error("candidate cleanup failed");
					active--;
				},
			},
		};
	};
	const settingsManager = SettingsManager.inMemory({ sessionSummary: { enabled: false } });
	const resourceLoader = new DefaultResourceLoader({
		cwd,
		agentDir: cwd,
		settingsManager,
		noExtensions: true,
		extensionFactories: [mcp],
	});
	const { session } = await createAgentSession({
		cwd,
		agentDir: cwd,
		settingsManager,
		resourceLoader,
		sessionManager: SessionManager.inMemory(cwd),
		builtins: { workflows: false, subagents: false, mcp: false, intercom: false, "web-access": false },
	});
	try {
		await entered.promise;
		const closing = session.dispose();
		let settled = false;
		const outcome = closing
			.then(
				() => undefined,
				(error: unknown) => error,
			)
			.finally(() => {
				settled = true;
			});
		await new Promise((resolve) => setTimeout(resolve, 20));
		assert.equal(settled, false);
		release.resolve();
		const error = await outcome;
		assert.equal(attempts, 1);
		if (fail) {
			assert.ok(error instanceof AggregateError && "code" in error && error.code === "ShutdownFailed");
			await assert.rejects(session.dispose(), (again) => again === error);
		} else {
			assert.equal(error, undefined);
			assert.equal(active, 0);
		}
	} finally {
		release.resolve();
		await session.dispose().catch(() => {});
		rmSync(cwd, { recursive: true, force: true });
	}
});
