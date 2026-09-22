/**
 * Tests for ExtensionRunner actionable boundaries (turn_end / agent_before_settle).
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AuthStorage } from "../../src/core/auth-storage.ts";
import { discoverAndLoadExtensions } from "../../src/core/extensions/loader.ts";
import { ExtensionRunner } from "../../src/core/extensions/runner.ts";
import type { BoundaryContextPreview, SessionBoundaryDraft } from "../../src/core/extensions/types.ts";
import { ModelRegistry } from "../../src/core/model-registry.ts";
import { ModelRuntime } from "../../src/core/model-runtime.ts";
import { SessionManager } from "../../src/core/session-manager.ts";

const emptyPreview: BoundaryContextPreview = {
	contextEntries: [],
	contextMessages: [],
	llmMessages: [],
	pendingMessages: [],
	canContinue: false,
};

describe("ExtensionRunner boundary chaining", () => {
	let tempDir: string;
	let extensionsDir: string;
	let sessionManager: SessionManager;
	let modelRegistry: ModelRegistry;

	beforeEach(async () => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-runner-boundary-"));
		extensionsDir = path.join(tempDir, "extensions");
		fs.mkdirSync(extensionsDir);
		sessionManager = SessionManager.inMemory();
		const authStorage = AuthStorage.create(path.join(tempDir, "auth.json"));
		modelRegistry = new ModelRegistry(await ModelRuntime.create({ credentials: authStorage, modelsPath: null }));
	});

	afterEach(() => {
		fs.rmSync(tempDir, { recursive: true, force: true });
	});

	async function loadRunner(): Promise<ExtensionRunner> {
		const result = await discoverAndLoadExtensions([], tempDir, tempDir);
		return new ExtensionRunner(result.extensions, result.runtime, tempDir, sessionManager, modelRegistry);
	}

	it("chains shared draft proposals and preserves omitted result fields", async () => {
		fs.writeFileSync(
			path.join(extensionsDir, "a-first.ts"),
			`
			export default function(pi) {
				pi.on("agent_before_settle", (event) => {
					globalThis.__boundaryObservations.push({
						entries: event.entries.length,
						continuation: event.continue,
						preview: event.context.contextEntries.length,
					});
					event.entries.push({ type: "custom", customType: "first", data: 1 });
					return { continue: true };
				});
			}
		`,
		);
		fs.writeFileSync(
			path.join(extensionsDir, "b-second.ts"),
			`
			export default function(pi) {
				pi.on("agent_before_settle", (event) => {
					globalThis.__boundaryObservations.push({
						entries: event.entries.length,
						continuation: event.continue,
						preview: event.context.contextEntries.length,
					});
					return { entries: [] };
				});
			}
		`,
		);
		const observations: Array<{ entries: number; continuation: boolean; preview: number }> = [];
		(globalThis as { __boundaryObservations?: typeof observations }).__boundaryObservations = observations;
		try {
			const runner = await loadRunner();
			const result = await runner.emitBoundary(
				{ type: "agent_before_settle", outcome: "completed" },
				(entries: SessionBoundaryDraft[]) => ({
					...emptyPreview,
					contextEntries: entries.map((entry, index) => ({
						sourceEntry: {
							type: "custom" as const,
							id: `draft-${index}`,
							parentId: null,
							timestamp: "",
							customType: entry.type,
						},
						messages: [],
					})),
				}),
			);

			expect(observations).toEqual([
				{ entries: 0, continuation: false, preview: 0 },
				{ entries: 1, continuation: true, preview: 1 },
			]);
			expect(result.entries).toEqual([]);
			expect(result.continue).toBe(true);
			expect(result.valid).toBe(true);
		} finally {
			delete (globalThis as { __boundaryObservations?: typeof observations }).__boundaryObservations;
		}
	});

	it("reports invalid boundary previews and lets later handlers repair the proposal", async () => {
		fs.writeFileSync(
			path.join(extensionsDir, "a-invalid.ts"),
			`
			export default function(pi) {
				pi.on("agent_before_settle", () => ({
					entries: [{ type: "context_edit", targetId: "missing", replacement: null }],
				}));
			}
		`,
		);
		fs.writeFileSync(
			path.join(extensionsDir, "b-repair.ts"),
			`
			export default function(pi) {
				pi.on("agent_before_settle", (event) => {
					globalThis.__boundaryRepairSeen = event.entries.length;
					return { entries: [] };
				});
			}
		`,
		);
		const globals = globalThis as { __boundaryRepairSeen?: number };
		try {
			const runner = await loadRunner();
			const errors: string[] = [];
			runner.onError((error) => errors.push(error.error));

			const result = await runner.emitBoundary({ type: "agent_before_settle", outcome: "completed" }, (entries) => {
				if (entries.some((entry) => entry.type === "context_edit")) throw new Error("Entry missing not found");
				return emptyPreview;
			});

			expect(globals.__boundaryRepairSeen).toBe(1);
			expect(errors).toContain("Invalid boundary entries: Entry missing not found");
			expect(result.entries).toEqual([]);
			expect(result.valid).toBe(true);
		} finally {
			delete globals.__boundaryRepairSeen;
		}
	});

	it("keeps shared mutations made before a handler throws", async () => {
		fs.writeFileSync(
			path.join(extensionsDir, "throws.ts"),
			`
			export default function(pi) {
				pi.on("agent_before_settle", (event) => {
					event.entries.push({ type: "custom", customType: "kept" });
					throw new Error("boundary failed");
				});
			}
		`,
		);
		const runner = await loadRunner();
		const errors: string[] = [];
		runner.onError((error) => errors.push(error.error));

		const result = await runner.emitBoundary(
			{ type: "agent_before_settle", outcome: "completed" },
			() => emptyPreview,
		);

		expect(result.entries).toMatchObject([{ type: "custom", customType: "kept" }]);
		expect(errors).toEqual(["boundary failed"]);
	});

	it("invalidates the whole proposal when the final preview cannot be built", async () => {
		fs.writeFileSync(
			path.join(extensionsDir, "bad.ts"),
			`
			export default function(pi) {
				pi.on("turn_end", () => ({
					entries: [{ type: "context_edit", targetId: "missing", replacement: null }],
					continue: true,
				}));
			}
		`,
		);
		const runner = await loadRunner();
		const errors: string[] = [];
		runner.onError((error) => errors.push(error.error));

		const result = await runner.emitBoundary(
			{
				type: "turn_end",
				turnIndex: 0,
				message: {
					role: "assistant",
					content: [],
					api: "faux",
					provider: "faux",
					model: "faux",
					usage: {
						input: 0,
						output: 0,
						cacheRead: 0,
						cacheWrite: 0,
						totalTokens: 0,
						cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
					},
					stopReason: "stop",
					timestamp: Date.now(),
				},
				toolResults: [],
				messageEntryId: "assistant-1",
				toolResultEntryIds: [],
				outcome: "completed",
			},
			(entries) => {
				if (entries.length > 0) throw new Error("Entry missing not found");
				return emptyPreview;
			},
		);

		expect(result.valid).toBe(false);
		expect(result.entries).toEqual([]);
		expect(result.continue).toBe(false);
		expect(errors).toEqual(["Invalid boundary entries: Entry missing not found"]);
	});
});
