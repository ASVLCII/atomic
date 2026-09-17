import assert from "node:assert/strict";
import { inspect } from "node:util";
import { type OAuthClientProvider, startAuthorization } from "@modelcontextprotocol/sdk/client/auth.js";
import { afterEach, test, vi } from "vitest";
import { getOAuthState } from "../../packages/mcp/mcp-auth.js";
import { authenticate, completeAuth, shutdownOAuth, startAuth } from "../../packages/mcp/mcp-auth-flow.js";
import { makeTempDirectory, removeTempDirectory } from "../helpers/runtime.js";

const browser = vi.hoisted(() => ({ url: "https://example.com/authorize", open: vi.fn() }));
vi.mock("open", () => ({ default: browser.open }));
vi.mock("@modelcontextprotocol/sdk/client/auth.js", async (importOriginal) => ({
	...(await importOriginal<typeof import("@modelcontextprotocol/sdk/client/auth.js")>()),
	auth: async (provider: OAuthClientProvider) => {
		await provider.redirectToAuthorization(new URL(browser.url));
		return "REDIRECT";
	},
}));
afterEach(async () => {
	await shutdownOAuth();
	vi.unstubAllEnvs();
	browser.open.mockReset();
});

// Regression for #3088: safe browser URLs retain the existing manual-open fallback.
test("MCP browser failure retains non-sensitive manual URL without a raw cause", async () => {
	const dir = makeTempDirectory("mcp-browser-diagnostics-");
	vi.stubEnv("MCP_OAUTH_DIR", dir);
	const { authorizationUrl } = await startAuthorization("https://example.com", {
		clientInformation: { client_id: "public" },
		redirectUrl: "http://127.0.0.1:19823/callback",
		state: "a7b93f010fd67b927558e1aeb0562340",
		scope: "read",
	});
	assert.equal(authorizationUrl.searchParams.get("code_challenge_method"), "S256");
	assert.ok(authorizationUrl.searchParams.get("code_challenge"));
	browser.url = authorizationUrl.href;
	browser.open.mockRejectedValue(new Error("browser stderr containing PRIVATE_CAUSE"));
	try {
		await assert.rejects(authenticate("browser", "https://example.com/mcp"), (error: Error) => {
			assert.ok(error.message.includes(`Please open this URL manually: ${browser.url}`));
			assert.doesNotMatch(inspect(error, { depth: null, showHidden: true }), /PRIVATE_CAUSE/);
			return true;
		});
		assert.equal(browser.open.mock.calls[0]?.[0], browser.url);
		assert.equal(getOAuthState("browser"), undefined);
		await assert.rejects(completeAuth("browser", "unused"), /No pending OAuth flow/);
	} finally {
		await shutdownOAuth();
		removeTempDirectory(dir);
	}
});

// Regression for #3088: never print secret-bearing authorization URLs or browser stderr.
test("MCP browser failure hides sensitive URLs but startAuth still returns them", async () => {
	const dir = makeTempDirectory("mcp-browser-secrets-");
	vi.stubEnv("MCP_OAUTH_DIR", dir);
	browser.open.mockRejectedValue(new Error("browser stderr containing PRIVATE_CAUSE"));
	try {
		for (const url of [
			"https://user:PRIVATE_PASSWORD@example.com/authorize",
			"https://example.com/authorize?token=PRIVATE_TOKEN",
			"https://example.com/authorize?resource=https%3A%2F%2Fexample.com%2Fmcp%3Fkey%3DPRIVATE_KEY",
			"https://example.com/authorize#PRIVATE_FRAGMENT",
		]) {
			browser.url = url;
			assert.equal((await startAuth("manual", "https://example.com/mcp")).authorizationUrl, url);
			await assert.rejects(authenticate("browser", "https://example.com/mcp"), (error: Error) => {
				assert.match(error.message, /Check your default browser and retry MCP authentication/);
				assert.doesNotMatch(inspect(error, { depth: null, showHidden: true }), /PRIVATE_|https:/);
				return true;
			});
			assert.equal(browser.open.mock.lastCall?.[0], url);
		}
	} finally {
		await shutdownOAuth();
		removeTempDirectory(dir);
	}
});

// Regression for #3088: the SDK can carry configured endpoint credentials in resource.
test("MCP browser failure withholds SDK resource credentials", async () => {
	const dir = makeTempDirectory("mcp-browser-resource-");
	vi.stubEnv("MCP_OAUTH_DIR", dir);
	const endpoint = "https://example.com/mcp?PRIVATE_TOKEN=";
	const { authorizationUrl } = await startAuthorization("https://example.com", {
		clientInformation: { client_id: "public" },
		redirectUrl: "http://127.0.0.1:19823/callback",
		state: "ordinary-state",
		resource: new URL(endpoint),
	});
	browser.url = authorizationUrl.href;
	browser.open.mockRejectedValue(new Error("PRIVATE_CAUSE"));
	try {
		assert.equal((await startAuth("manual", endpoint)).authorizationUrl, browser.url);
		await assert.rejects(authenticate("browser", endpoint), (error: Error) => {
			assert.match(error.message, /Check your default browser and retry MCP authentication/);
			assert.doesNotMatch(inspect(error, { depth: null, showHidden: true }), /PRIVATE_|https:/);
			return true;
		});
		assert.equal(browser.open.mock.lastCall?.[0], browser.url);
	} finally {
		await shutdownOAuth();
		removeTempDirectory(dir);
	}
});

// Regression for #3088: standard OAuth fields must not expose configured credentials.
test("MCP browser failure withholds configured credential overlap", async () => {
	const dir = makeTempDirectory("mcp-browser-overlap-");
	vi.stubEnv("MCP_OAUTH_DIR", dir);
	browser.open.mockRejectedValue(new Error("PRIVATE_CAUSE"));
	try {
		for (const [endpoint, authorizationPath, state] of [
			["https://example.com/PRIVATE_PATH_TOKEN/mcp", "/PRIVATE_PATH_TOKEN/authorize", "ordinary-state"],
			["https://example.com/PRIVATE%2fPATH/mcp", "/PRIVATE%2FPATH/authorize", "ordinary-state"],
			["https://example.com/PRIVATE%2FPATH/mcp", "/authorize", "PRIVATE/PATH"],
			["https://example.com/mcp?PRIVATE_KEY=", "/authorize", "PRIVATE_KEY"],
			["https://example.com/mcp?key=PRIVATE+VALUE", "/authorize", "PRIVATE VALUE"],
		]) {
			const { authorizationUrl } = await startAuthorization("https://example.com", {
				clientInformation: { client_id: "public" },
				redirectUrl: "http://127.0.0.1:19823/callback",
				state,
			});
			authorizationUrl.pathname = authorizationPath!;
			browser.url = authorizationUrl.href;
			assert.equal((await startAuth("manual", endpoint!)).authorizationUrl, browser.url);
			await assert.rejects(authenticate("browser", endpoint!), (error: Error) => {
				assert.equal(
					error.message,
					"Could not open browser. Check your default browser and retry MCP authentication.",
				);
				assert.doesNotMatch(inspect(error, { depth: null, showHidden: true }), /PRIVATE|https:/);
				return true;
			});
			assert.equal(browser.open.mock.lastCall?.[0], browser.url);
		}
	} finally {
		await shutdownOAuth();
		removeTempDirectory(dir);
	}
});
