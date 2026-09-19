import assert from "node:assert/strict";
import { test, vi } from "vitest";
import { ConsentManager } from "../../packages/mcp/consent-manager.js";
import { McpLifecycleManager } from "../../packages/mcp/lifecycle.js";
import { McpServerManager } from "../../packages/mcp/server-manager.js";
import type { McpExtensionState } from "../../packages/mcp/state.js";
import { UiResourceHandler } from "../../packages/mcp/ui-resource-handler.js";
import { maybeStartUiSession } from "../../packages/mcp/ui-session.js";

const windows = vi.hoisted(() => ({ open: vi.fn() }));
vi.mock("../../packages/mcp/glimpse-ui.js", () => ({
	isGlimpseAvailable: () => true,
	openGlimpseWindow: windows.open,
}));

function owner(): McpExtensionState {
	const manager = new McpServerManager();
	const resourceHandler = new UiResourceHandler(manager);
	resourceHandler.readUiResource = async () => ({ uri: "ui://test", html: "<p>Owned UI</p>", meta: {} });
	return {
		manager,
		lifecycle: new McpLifecycleManager(manager),
		toolMetadata: new Map(),
		config: { mcpServers: {} },
		failureTracker: new Map(),
		uiResourceHandler: resourceHandler,
		consentManager: new ConsentManager("once-per-server"),
		uiServer: null,
		completedUiSessions: [],
		openBrowser: async () => {},
	};
}
const request = { serverName: "same", toolName: "same", toolArgs: {}, uiResourceUri: "ui://test" };

// #3105: native windows are external resources of the UI handle, not module-global state.
test("UI owners close only their own windows, including a window resolving after close", async () => {
	vi.stubEnv("MCP_UI_VIEWER", "glimpse");
	const first = owner();
	const second = owner();
	const firstClose = vi.fn();
	const secondClose = vi.fn();
	let release!: (window: { close(): void }) => void;
	let opening!: () => void;
	const started = new Promise<void>((resolve) => {
		opening = resolve;
	});
	windows.open.mockResolvedValueOnce({ close: firstClose }).mockImplementationOnce(() => {
		opening();
		return new Promise<{ close(): void }>((resolve) => {
			release = resolve;
		});
	});
	try {
		const a = await maybeStartUiSession(first, request);
		assert.ok(a);
		const pending = maybeStartUiSession(second, request);
		await started;
		assert.equal(firstClose.mock.calls.length, 0);
		second.uiServer!.close("shutdown");
		second.uiServer?.close("shutdown");
		release({ close: secondClose });
		const b = await pending;
		assert.ok(b);
		assert.equal(b.isActive(), false);
		assert.equal(secondClose.mock.calls.length, 1);
		assert.equal(a.isActive(), true);
		a.close("shutdown");
		a.close("shutdown");
		assert.equal(firstClose.mock.calls.length, 1);
	} finally {
		first.uiServer?.close("cleanup");
		second.uiServer?.close("cleanup");
		windows.open.mockReset();
		vi.unstubAllEnvs();
	}
});
