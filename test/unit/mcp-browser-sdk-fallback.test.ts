import assert from "node:assert/strict";
import { inspect } from "node:util";
import { afterEach, test, vi } from "vitest";
import { getOAuthState } from "../../packages/mcp/mcp-auth.js";
import { authenticate, completeAuth, shutdownOAuth } from "../../packages/mcp/mcp-auth-flow.js";
import { getPendingAuthCount } from "../../packages/mcp/mcp-callback-server.js";
import { resolveServerUrl } from "../../packages/mcp/utils.js";
import { makeTempDirectory, removeTempDirectory } from "../helpers/runtime.js";

const browser = vi.hoisted(() => ({ open: vi.fn() }));
vi.mock("open", () => ({ default: browser.open }));
const realFetch = globalThis.fetch;

afterEach(async () => {
	await shutdownOAuth();
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
	browser.open.mockReset();
});

// Regression for #3088: exercise the real SDK discovery, registration, state and PKCE flow.
// Only the network boundary and OS browser launcher are faked; auth itself is not mocked.
for (const [template, authorizationEndpoint] of [
	["https://example.com/api/v1.0/mcp", "https://example.com/api/v1.0/mcp/authorize"],
	[`https://example.com/\${PUBLIC_SERVICE}/mcp`, "https://example.com/weather/authorize"],
	[`https://example.com/access-\${PRIVATE_PATH}/mcp`, "https://example.com/PRIVATE_PATH_CREDENTIAL/authorize"],
	["https://example.com/PRIVATE%2fPATH/mcp", "https://example.com/PRIVATE%2FPATH/authorize"],
	[
		"https://example.com/mcp?PRIVATE_KEY=&PRIVATE_FLAG",
		"https://example.com/authorize?token=PRIVATE_TOKEN&custom=value#PRIVATE_FRAGMENT",
	],
	["https://example.com/mcp", "https://user:PRIVATE_PASSWORD@example.com/authorize"],
]) {
	test(`MCP SDK browser failure returns the exact manual URL for ${template}`, async () => {
		const dir = makeTempDirectory("mcp-browser-sdk-");
		vi.stubEnv("MCP_OAUTH_DIR", dir);
		vi.stubEnv("PUBLIC_SERVICE", "weather");
		vi.stubEnv("PRIVATE_PATH", "PRIVATE_PATH_CREDENTIAL");
		const endpoint = resolveServerUrl(template!);
		const requests: string[] = [];
		const fetchFixture = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
			const url = new URL(input instanceof Request ? input.url : input);
			requests.push(url.href);
			if (url.pathname.includes("/.well-known/oauth-protected-resource")) {
				return Response.json({
					resource: endpoint,
					authorization_servers: ["https://example.com"],
					scopes_supported: ["read", "offline_access"],
				});
			}
			if (url.pathname === "/.well-known/oauth-authorization-server") {
				return Response.json({
					issuer: "https://example.com",
					authorization_endpoint: authorizationEndpoint,
					token_endpoint: "https://example.com/token",
					registration_endpoint: "https://example.com/register",
					response_types_supported: ["code"],
					code_challenge_methods_supported: ["S256"],
				});
			}
			assert.equal(url.href, "https://example.com/register");
			assert.equal(init?.method, "POST");
			return Response.json({ ...JSON.parse(String(init?.body)), client_id: "public-client" }, { status: 201 });
		});
		vi.stubGlobal("fetch", fetchFixture);
		browser.open.mockImplementation(async () => {
			vi.stubEnv("PUBLIC_SERVICE", "changed-after-discovery");
			vi.stubEnv("PRIVATE_PATH", "changed-after-discovery");
			throw new Error("PRIVATE_BROWSER_STDERR", { cause: new Error("PRIVATE_BROWSER_CAUSE") });
		});
		try {
			await assert.rejects(authenticate("sdk-browser", template!), (error: Error) => {
				const opened = browser.open.mock.lastCall?.[0];
				assert.equal(typeof opened, "string");
				const url = new URL(opened);
				assert.equal(url.searchParams.get("resource"), endpoint);
				assert.equal(url.searchParams.get("client_id"), "public-client");
				assert.equal(url.searchParams.get("response_type"), "code");
				assert.equal(url.searchParams.get("scope"), "read offline_access");
				assert.equal(url.searchParams.get("prompt"), "consent");
				assert.equal(url.searchParams.get("code_challenge_method"), "S256");
				assert.ok(url.searchParams.get("code_challenge"));
				assert.ok(url.searchParams.get("state"));
				assert.match(url.searchParams.get("redirect_uri")!, /^http:\/\/localhost:\d+\/callback$/);
				assert.equal(error.message, `Could not open browser. Please open this URL manually: ${opened}`);
				assert.doesNotMatch(inspect(error, { depth: null, showHidden: true }), /PRIVATE_BROWSER_/);
				return true;
			});
			assert.ok(requests.some((url) => url.includes("oauth-protected-resource")));
			assert.ok(requests.includes("https://example.com/register"));
			assert.equal(getPendingAuthCount(), 0);
			assert.equal(getOAuthState("sdk-browser"), undefined);
			await assert.rejects(completeAuth("sdk-browser", "unused"), /No pending OAuth flow/);
			const opened = new URL(browser.open.mock.lastCall?.[0]);
			const callback = new URL(opened.searchParams.get("redirect_uri")!);
			callback.searchParams.set("state", opened.searchParams.get("state")!);
			callback.searchParams.set("code", "late-code");
			assert.equal((await realFetch(callback)).status, 400, "failed attempt cannot accept a late callback");
		} finally {
			await shutdownOAuth();
			removeTempDirectory(dir);
		}
	});
}
