import type { WorkflowDefinition } from "../shared/types.js";
import type { PiExecuteContext } from "./public-types.js";
import { workflowCaller } from "./workflow-instance-owner.js";
import type { WorkflowRouterOutput } from "./workflow-router.js";

export interface WorkflowReservation {
	readonly id: string;
	readonly owner: string;
	readonly definition: WorkflowDefinition;
	readonly decision: WorkflowRouterOutput;
	readonly assertCurrent: () => void;
	state: "reserved" | "admitting" | "admitted" | "invalidated";
}

/** Owned by one registered model tool. Disposal releases reservations, never executing instances. */
export class WorkflowReservations {
	private readonly entries = new Map<string, WorkflowReservation>();

	register(
		ctx: PiExecuteContext,
		definition: WorkflowDefinition,
		decision: WorkflowRouterOutput,
		assertCurrent: () => void,
	): WorkflowReservation {
		const entry: WorkflowReservation = {
			id: crypto.randomUUID(),
			owner: workflowCaller(ctx),
			definition,
			decision: structuredClone(decision),
			assertCurrent,
			state: "reserved",
		};
		this.entries.set(entry.id, entry);
		return entry;
	}

	assertCurrent(id: string): void {
		this.entries.get(id)?.assertCurrent();
	}

	resolve(id: string | undefined, ctx: PiExecuteContext): WorkflowReservation {
		if (id === undefined || id === "") throw new Error("Workflow run requires a registered workflowId from route.");
		const entry = this.entries.get(id);
		if (!entry)
			throw new Error("Unknown or expired workflowId. Route the current request before starting a new execution.");
		if (entry.owner !== workflowCaller(ctx))
			throw new Error("Workflow reservation belongs to another caller/session.");
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
