import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// #3105: unavailable provider/extractor dependencies are explicit failures under built Node.
const root = mkdtempSync(join(tmpdir(), "sdk-web-unavailable-"));
process.env.HOME = root;
process.env.USERPROFILE = root;
process.env.ATOMIC_CODING_AGENT_DIR = join(root, "agent");
process.env.ATOMIC_ALLOW_BROWSER_COOKIES = "0";
for (const key of ["GEMINI_API_KEY", "PERPLEXITY_API_KEY", "EXA_API_KEY"]) delete process.env[key];
mkdirSync(join(root, ".atomic"), { recursive: true });
writeFileSync(join(root, ".atomic", "web-search.json"), JSON.stringify({ allowBrowserCookies: false }));
const sessions = [];
try {
 const { createAgentSession, SessionManager, SettingsManager, ModelRuntime } = await import("@bastani/atomic");
 const modelRuntime = await ModelRuntime.create({ authPath: join(root, "auth"), modelsPath: null, allowModelNetwork: false });
 const { session } = await createAgentSession({ cwd: root, agentDir: join(root, "agent"), modelRuntime,
  settingsManager: SettingsManager.inMemory({ sessionSummary: { enabled: false } }), sessionManager: SessionManager.inMemory(root),
  builtins: { workflows: false, subagents: false, mcp: false, intercom: false } });
 sessions.push(session);
 const search = session.agent.state.tools.find(tool => tool.name === "web_search");
 const failedSearch = await search.execute("unavailable-provider", { query: "test", provider: "gemini" }, new AbortController().signal);
 assert.match(JSON.stringify(failedSearch), /Gemini search unavailable/);
 const video = join(root, "fixture.mp4");
 writeFileSync(video, "fixture video");
 process.env.PATH = join(root, "no-executables");
 const fetch = session.agent.state.tools.find(tool => tool.name === "fetch_content");
 const failedExtract = await fetch.execute("unavailable-extractor", { urls: [video], frames: 1, timestamp: "1" }, new AbortController().signal);
 assert.equal(failedExtract.details.successful, 0);
 assert.equal(failedExtract.details.outcome, "all_failed");
 assert.match(JSON.stringify(failedExtract.content), /ffmpeg.*not installed|ffprobe.*not installed/);
 await Promise.all([session.dispose(), session.dispose()]);
 console.log(JSON.stringify({ verified: true }));
} finally {
 await Promise.all(sessions.map(session => session.dispose()));
 rmSync(root, { recursive: true, force: true });
}
