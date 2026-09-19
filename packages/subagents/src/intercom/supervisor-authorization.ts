import { isStaleExtensionContextError } from "@bastani/atomic";
import type { IntercomEventBus } from "../shared/types.js";

export const SUBAGENT_SUPERVISOR_AUTHORIZATION_EVENT = "subagent:supervisor-authorization";

export interface SupervisorAuthorization {
	capability: string;
	supervisorSessionId: string;
	childName: string;
}

/** Tool availability is required before requesting or attaching supervisor authority. */
export function childAllowsIntercom(options: import("@bastani/atomic").CreateAgentSessionOptions): boolean {
	if (options.builtins?.intercom === false || options.noTools === "all" || options.excludedTools?.includes("intercom"))
		return false;
	return ["intercom", "contact_supervisor"].some(
		(name) => !options.excludedTools?.includes(name) && (options.tools === undefined || options.tools.includes(name)),
	);
}
/** Ask the parent Intercom extension to mint a broker-issued child capability. */
export async function requestSupervisorAuthorization(
	events: IntercomEventBus | undefined,
	childName: string | undefined,
	childOptions?: import("@bastani/atomic").CreateAgentSessionOptions,
): Promise<SupervisorAuthorization | undefined> {
	if (childOptions && !childAllowsIntercom(childOptions)) return undefined;
	const normalizedChildName = childName?.trim();
	if (!events || !normalizedChildName) return undefined;
	const request: { childName: string; completion?: Promise<SupervisorAuthorization> } = {
		childName: normalizedChildName,
	};
	try {
		events.emit(SUBAGENT_SUPERVISOR_AUTHORIZATION_EVENT, request);
		return request.completion ? await request.completion : undefined;
	} catch (error) {
		if (!isStaleExtensionContextError(error)) throw error;
		// Authorization is advisory when a child outlives its parent runtime.
		return undefined;
	}
}
