import { adoptToolControlRegistry } from "../engine/run-tool-control-registry.js";
import { adoptCancellationRegistry } from "../runs/background/cancellation-registry.js";
import { adoptJobTracker } from "../runs/background/job-tracker.js";
import { adoptStageControlRegistry } from "../runs/foreground/stage-control-registry.js";
import { adoptStageUiBroker } from "../shared/stage-ui-broker.js";
import { adoptStore, adoptWorkflowHostStore } from "../shared/store-factory.js";

/**
 * Re-bind every run-scoped singleton to host session state for `scope`.
 * No-op when the host has not supplied a scope (unit tests, embedded SDK).
 */
export function adoptWorkflowSessionRunState(scope: object | undefined, scopedOwnership = false): void {
	if (scope === undefined) return;
	// Explicit ownership retains predecessor runtimes; never infer transfer
	// from whichever sibling most recently adopted a singleton.
	let recoveredCurrent = false;
	if (scopedOwnership) adoptStore(scope);
	else recoveredCurrent = adoptWorkflowHostStore(scope).recoveredCurrent;
	adoptStageControlRegistry(scope, recoveredCurrent);
	adoptCancellationRegistry(scope, recoveredCurrent);
	adoptToolControlRegistry(scope, recoveredCurrent);
	adoptJobTracker(scope, recoveredCurrent);
	adoptStageUiBroker(scope, recoveredCurrent);
}
