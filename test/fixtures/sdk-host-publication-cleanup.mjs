import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { build } from "esbuild";
import { createAgentSession, DefaultResourceLoader, SettingsManager, SessionManager, ModelRuntime } from "@bastani/atomic";

// #3105: actual Node SDK and MCP adapter lifecycle, with only initializer/services controlled.
const mode = process.argv[2];
const cwd = mkdtempSync(join(tmpdir(), "sdk-publication-cleanup-"));
const settingsManager = SettingsManager.inMemory({ sessionSummary: { enabled: false } });
const modelRuntime = await ModelRuntime.create({ authPath: join(cwd, "auth"), modelsPath: null, allowModelNetwork: false });
const options = { cwd, agentDir: cwd, settingsManager, modelRuntime, sessionManager: SessionManager.inMemory(cwd), builtins: { workflows: false, subagents: false, mcp: false, intercom: false, "web-access": false } };
let session;
let expectedFailure = false;
try {
 if (mode.startsWith("mcp")) {
  const entered = Promise.withResolvers(); const release = Promise.withResolvers();
  const state = { entered, release, active: 0, attempts: 0, oauth: 0, fail: mode === "mcp-failure" };
  globalThis.mcpCleanupFixture = state;
  const mocks = {
   "config.js": "export function loadMcpConfig(){return {mcpServers:{fixture:{lifecycle:'eager'}}};}",
   "utils.js": "export function getConfigPathFromArgv(){}",
   "command-registration.js": "export function registerMcpCommands(){}",
   "metadata-cache.js": "export function loadMetadataCache(){return null;}",
   "direct-tools.js": "export function resolveDirectTools(){return [];} export function getMissingConfiguredDirectToolServers(){return [];} export function createDirectToolExecutor(){}",
   "startup-warmup.js": "export function scheduleMcpStartupWarmup(){return {cancel(){}};}",
   "mcp-auth-flow.js": "export async function shutdownOAuth(){globalThis.mcpCleanupFixture.oauth++;}",
   "tool-result-renderer.js": "export function renderMcpToolResult(){}",
   "tool-call-renderer.js": "export function renderMcpToolCall(){} export function renderMcpDirectToolCall(){}",
   "init.js": `export async function initializeMcp(){const s=globalThis.mcpCleanupFixture;s.entered.resolve();await s.release.promise;s.active++;return {config:{mcpServers:{}},toolMetadata:new Map(),failureTracker:new Map(),uiServer:null,lifecycle:{async gracefulShutdown(){s.attempts++;if(s.fail)throw new Error('candidate cleanup failed');s.active--;}}};} export function updateStatusBar(){} export function flushMetadataCache(){}`,
  };
  const source = fileURLToPath(new URL("../../packages/mcp/index.ts", import.meta.url));
  const outfile = join(cwd, "adapter.mjs");
  await build({ entryPoints: [source], outfile, bundle: true, platform: "node", format: "esm", plugins: [{ name: "controlled-mcp-initializer", setup(builder) {
   builder.onResolve({ filter: /^\.\// }, args => {
    const name = args.path.slice(2).replace(/\.ts$/, ".js");
    if (mocks[name] && args.importer === source) return { path: name, namespace: "fixture" };
   });
   builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ contents: mocks[args.path], loader: "js" }));
   builder.onResolve({ filter: /^(@bastani\/atomic|typebox)$/ }, args => ({ path: import.meta.resolve(args.path).replace(/^file:\/\//, ""), external: true }));
  } }] });
  const { default: mcp } = await import(pathToFileURL(outfile).href);
  const resourceLoader = new DefaultResourceLoader({ cwd, agentDir: cwd, settingsManager, noExtensions: true, extensionFactories: [mcp] });
  ({ session } = await createAgentSession({ ...options, resourceLoader }));
  await entered.promise;
  let settled = false;
  const closing = session.dispose().then(() => undefined, error => error).finally(() => { settled = true; });
  await delay(20); assert.equal(settled, false); release.resolve();
  const error = await closing; expectedFailure = state.fail;
  assert.equal(state.attempts, 1); assert.equal(state.oauth, 2);
  if (state.fail) { assert.equal(error?.code, "ShutdownFailed"); await assert.rejects(session.dispose(), again => again === error); }
  else { assert.equal(error, undefined); assert.equal(state.active, 0); }
 } else {
  const active = new Set(); let next = 0;
  class Loader extends DefaultResourceLoader {
   async prepareReload(...args) {
    const tx = await super.prepareReload(...args);
    return { ...tx, activate(settings) { if (mode.startsWith("activate")) throw new Error("activation failed"); tx.activate(settings); }, prepareCommit() {
     const prepared = tx.prepareCommit(); return { ...prepared, commit() { if (mode === "commit") throw new Error("commit failed"); prepared.commit(); } };
    } };
   }
  }
  const resourceLoader = new Loader({ cwd, agentDir: cwd, settingsManager, noExtensions: true, extensionFactories: [pi => {
   const id = ++next; pi.on("session_start", () => { active.add(id); }); pi.on("session_shutdown", () => { active.delete(id); if (id === 4 && mode === "activate-cleanup") throw new Error("candidate cleanup failed"); });
  }] });
  await resourceLoader.reload(); ({ session } = await createAgentSession({ ...options, resourceLoader }));
  if (mode === "settings") { const prepare = settingsManager.prepareReload.bind(settingsManager); settingsManager.prepareReload = async () => ({ ...await prepare(), commit() { throw new Error("settings commit failed"); } }); }
  expectedFailure = mode === "activate-cleanup";
  if (mode === "control") await session.reload(); else await assert.rejects(session.reload(), expectedFailure ? { code: "ShutdownFailed" } : /failed/);
  assert.equal(active.size, 1);
  await session.dispose().catch(error => { assert.ok(expectedFailure); assert.equal(error.code, "ShutdownFailed"); }); assert.equal(active.size, 0);
 }
 console.log(JSON.stringify({ mode, verified: true }));
} finally {
 if (session) await session.dispose().catch(error => { if (!expectedFailure) throw error; });
 rmSync(cwd, { recursive: true, force: true });
}
