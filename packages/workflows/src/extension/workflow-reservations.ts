import type { WorkflowDefinition } from "../shared/types.js";
import type { PiExecuteContext } from "./public-types.js";
import type { WorkflowRouterOutput } from "./workflow-router.js";

export interface WorkflowReservation {
	readonly id: string;
	readonly owner: string | object;
	readonly definition: WorkflowDefinition;
	readonly decision: WorkflowRouterOutput;
	readonly assertCurrent: () => void;
	state: "reserved" | "admitting" | "admitted" | "invalidated";
}

/** Owned by one registered model tool. Disposal releases reservations, never executing instances. */
export class WorkflowReservations {
	private readonly entries = new Map<string, WorkflowReservation>();

	private owner(ctx: PiExecuteContext): string | object {
		return ctx.sessionId ?? ctx.sessionManager?.getSessionId?.() ?? ctx.sessionManager ?? ctx;
	}

	register(
		ctx: PiExecuteContext,
		definition: WorkflowDefinition,
		decision: WorkflowRouterOutput,
		assertCurrent: () => void,
	): WorkflowReservation {
		const entry: WorkflowReservation = {
			id: crypto.randomUUID(),
			owner: this.owner(ctx),
			definition,
			decision: structuredClone(decision),
			assertCurrent,
			state: "reserved",
		};
		this.entries.set(entry.id, entry);
		return entry;
	}

	assertOwner(id: string, ctx: PiExecuteContext, resume = false): void {
		const matches = [...this.entries.values()].filter(
			(entry) => entry.id === id || (id.length === 8 && entry.id.startsWith(id)),
		);
		for (const entry of matches) {
			if (entry.owner !== this.owner(ctx)) throw new Error("Workflow instance belongs to another caller/session.");
			if (resume) entry.assertCurrent();
		}
	}

	resolve(id: string | undefined, ctx: PiExecuteContext): WorkflowReservation {
		if (id === undefined || id === "") throw new Error("Workflow run requires a registered workflowId from route.");
		const entry = this.entries.get(id);
		if (!entry)
			throw new Error("Unknown or expired workflowId. Route the current request before starting a new execution.");
		if (entry.owner !== this.owner(ctx)) throw new Error("Workflow reservation belongs to another caller/session.");
		if (entry.state === "invalidated")
			throw new Error("Workflow reservation is invalidated. Make a fresh route request.");
		try {
			entry.assertCurrent();
		} catch (error) {
			entry.state = "invalidated";
			throw error;
		}
		return entry;
	}
}
