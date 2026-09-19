import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager } from "../../packages/coding-agent/dist/index.js";

// #3105: normal Node exit must follow late provider acquisition and owned cleanup.
const mode = process.argv[2];
assert.ok(["dispose", "reload", "control", "error", "replay", "replay-error", "overlap", "self"].includes(mode));
const cwd = mkdtempSync(join(tmpdir(), "sdk-refresh-node-"));
const settingsManager = SettingsManager.inMemory({ sessionSummary: { enabled: false } });
const modelRuntime = await ModelRuntime.create({ authPath: join(cwd, "auth"), modelsPath: null, allowModelNetwork: false });
let release, enter;
const held = new Promise(resolve => { release = resolve; });
const entered = new Promise(resolve => { enter = resolve; });
const live = new Set();
const order = [];
const primary = new Error("refresh replay primary");
const providerError = new Error("refresh provider failed");
const cleanupError = new Error("refresh cleanup failed");
const replay = mode.startsWith("replay");
let api, session, refreshing, generation = 0;
class Loader extends DefaultResourceLoader {
 async refreshWorkflowResources() {
  const invoking = api;
  enter();
  await held;
  if (mode === "self") await session.reload();
  else {
   const unsubscribe = invoking.events.on("late-refresh", () => {});
   unsubscribe();
  }
  live.add(setInterval(() => {}, 1000));
  order.push("acquired");
  if (mode.endsWith("error")) throw providerError;
  return [];
 }
}
const loader = new Loader({ cwd, agentDir: cwd, settingsManager, noExtensions: true,
 extensionFactories: [pi => {
  const id = ++generation;
  api = pi;
  pi.on("session_shutdown", () => {
   order.push(`shutdown${id}`);
   for (const timer of live) clearInterval(timer);
   live.clear();
   if (mode.endsWith("error")) throw cleanupError;
  });
  if (replay && id === 2) {
   refreshing = pi.refreshWorkflowResources();
   void refreshing.catch(() => {});
   throw primary;
  }
 }],
});
const causes = value => value instanceof AggregateError ? [value, ...value.errors.flatMap(causes)] : value instanceof Error && value.cause ? [value, ...causes(value.cause)] : [value];
try {
 await loader.reload();
 const creating = createAgentSession({ cwd, agentDir: cwd, settingsManager, modelRuntime, resourceLoader: loader,
  sessionManager: SessionManager.inMemory(cwd), builtins: { workflows: false, subagents: false, mcp: false, intercom: false, "web-access": false }, tools: [] });
 let settled = false, observed, terminal;
 if (replay) observed = creating.catch(error => error).finally(() => { settled = true; });
 else {
  ({ session } = await creating);
  refreshing = api.refreshWorkflowResources();
  void refreshing.catch(() => {});
  await entered;
  if (mode === "control" || mode === "self") { release(); await refreshing; }
  const closing = mode === "reload" || mode === "overlap" ? session.reload() : session.dispose();
  observed = closing.catch(error => error).finally(() => { settled = true; });
  if (mode === "overlap") terminal = session.dispose();
  else if (mode !== "reload") assert.equal(session.dispose(), closing);
 }
 await entered;
 const stale = api;
 if (mode !== "self") await assert.rejects(stale.refreshWorkflowResources(), /closed|stale/i);
 await delay(25);
 const beforeRelease = { settled, order: [...order] };
 release();
 const [refreshOutcome, outcome] = await Promise.all([refreshing.catch(error => error), observed]);
 await terminal;
 await session?.dispose().catch(() => {});
 if (mode !== "control" && mode !== "self") {
  assert.equal(beforeRelease.settled, false, "cleanup completed before provider release");
  assert.deepEqual(beforeRelease.order, []);
 }
 assert.equal(live.size, 0, "late acquisition survived cleanup");
	if (mode !== "self") assert.equal(order[0], "acquired");
	assert.ok(order.indexOf("acquired") < order.indexOf("shutdown2"));
 assert.equal(order.filter(item => item === "shutdown2").length, 1);
 assert.ok(!order.includes("shutdown1"), "borrowed discovery must survive");
 if (mode.endsWith("error")) {
  assert.equal(refreshOutcome, providerError);
	if (replay) {
	 assert.ok(causes(outcome).includes(cleanupError));
	 assert.ok(causes(outcome).includes(primary));
	} else assert.match(causes(outcome).map(String).join("\n"), /refresh cleanup failed/);
 } else {
  assert.deepEqual(refreshOutcome, []);
  if (replay) assert.equal(outcome, primary);
  else if (mode === "overlap") assert.equal(outcome?.code, "SessionClosed");
  else assert.equal(outcome, undefined);
 }
 console.log(JSON.stringify({ mode, verified: true, order, live: live.size }));
} finally {
 release();
 await session?.dispose().catch(() => {});
 // Diagnostic failure cleanup is not counted as product cleanup above.
 for (const timer of live) clearInterval(timer);
 rmSync(cwd, { recursive: true, force: true });
}
