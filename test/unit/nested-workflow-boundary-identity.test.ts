import assert from "node:assert/strict";
import { test } from "vitest";
import { workflowBoundarySegments } from "../../packages/workflows/src/shared/pending-stage-status.js";
import type { RunSnapshot } from "../../packages/workflows/src/shared/store-types.js";

// #3020: repeated ctx.workflow() calls must not advertise another owner's route on fallback.
test.each(["workflow:child", "first-boundary-id"])(
	"repeated nested identities preserve routing precedence for %s",
	(firstId) => {
		const root: RunSnapshot = {
			id: "root",
			name: "root",
			inputs: {},
			status: "running",
			startedAt: 1,
			stages: [firstId, "second-boundary-id"].map((id) => ({
				id,
				name: "workflow:child",
				status: "running",
				parentIds: [],
				toolEvents: [],
			})),
		};
		const children: RunSnapshot[] = root.stages.map((boundary, index) => ({
			id: `child-${index}`,
			name: "child",
			inputs: {},
			status: "running",
			startedAt: 1,
			parentRunId: root.id,
			parentStageId: boundary.id,
			stages: [
				{
					id: "workflow:grandchild",
					name: "workflow:grandchild",
					status: "running",
					parentIds: [],
					toolEvents: [],
				},
			],
		}));
		const grandchildren: RunSnapshot[] = children.map((child, index) => ({
			id: `grandchild-${index}`,
			name: "grandchild",
			inputs: {},
			status: "running",
			startedAt: 1,
			parentRunId: child.id,
			parentStageId: "workflow:grandchild",
			stages: [],
		}));
		const runs = [root, ...children, ...grandchildren];
		const firstSegment = firstId === "workflow:child" ? "workflow:child" : "child-0";
		assert.deepEqual(workflowBoundarySegments(runs, children[0]!.id), [firstSegment]);
		assert.deepEqual(workflowBoundarySegments(runs, children[1]!.id), ["child-1"]);
		assert.deepEqual(workflowBoundarySegments(runs, grandchildren[0]!.id), [firstSegment, "workflow:grandchild"]);
		assert.deepEqual(workflowBoundarySegments(runs, grandchildren[1]!.id), ["child-1", "workflow:grandchild"]);
		// A sibling can be not yet started or temporarily absent during durable hydration.
		// Its materialized boundary still reserves the shared name.
		const withoutFirstChild = runs.filter((run) => run.id !== children[0]!.id);
		assert.deepEqual(workflowBoundarySegments(withoutFirstChild, children[1]!.id), ["child-1"]);
	},
);
