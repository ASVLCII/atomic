import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "vitest";

// #3111: cover shipped definitions, not SDK defaults that can mask narrow allowlists.
test("every shipped subagent declares Intercom", () => {
	const root = join(process.cwd(), "packages/subagents/agents");
	const agents = readdirSync(root).filter((file) => file.endsWith(".md"));
	assert.ok(agents.length >= 9);
	for (const agent of agents) {
		const tools = /^tools: (.+)$/m.exec(readFileSync(join(root, agent), "utf8"))?.[1]?.split(/,\s*/);
		assert.ok(tools?.includes("intercom"), agent);
	}
});

test("builtin workflow literal tool allowlists retain Intercom", () => {
	let checked = 0;
	for (const root of ["packages/workflows/builtin", "packages/workflows/src"]) {
		for (const file of readdirSync(root, { recursive: true })
			.map(String)
			.filter((file) => file.endsWith(".ts") && !file.endsWith(".d.ts"))) {
			const path = join(root, file);
			const source = readFileSync(path, "utf8");
			// Graph snapshot arrays under src are not literal model tool selections.
			for (const match of source.matchAll(/(?:\btools\s*:|\b\w+Tools\s*=)\s*\[([^\]]*)\]/g)) {
				if (!/["']/.test(match[1]!) && root.endsWith("src")) continue;
				checked++;
				assert.match(match[1]!, /["']intercom["']/, path);
			}
		}
	}
	assert.ok(checked >= 2, "inventory must inspect classifier and shared runner tools");
});
