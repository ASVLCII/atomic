import { Type } from "typebox";

type QuarterMinute = 15 | 30 | 45;
type Hour = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23;
export type WorkflowEstimatedDuration =
	| `${QuarterMinute}min`
	| `${Hour}hr`
	| `${Hour}hr${QuarterMinute}min`
	| "1d"
	| "unknown"
	| ">1d";

/** Canonical wire labels. One day is 24 elapsed hours, not a working day. */
export const estimatedDurations: WorkflowEstimatedDuration[] = Array.from({ length: 96 }, (_, index) => {
	const minutes = (index + 1) * 15;
	if (minutes === 1440) return "1d";
	const hours = Math.floor(minutes / 60);
	return `${hours ? `${hours}hr` : ""}${minutes % 60 ? `${minutes % 60}min` : ""}` as WorkflowEstimatedDuration;
});
estimatedDurations.push("unknown", ">1d");

export const WorkflowEstimatedDurationSchema = Type.Enum(estimatedDurations, { type: "string" });
export const durationCriteria: Record<string, string> = Object.fromEntries(
	estimatedDurations.map((label, index) => [
		label,
		label === "unknown"
			? "There is insufficient evidence to estimate duration. This does not mean a long task."
			: label === ">1d"
				? "Estimated elapsed wall-clock duration is greater than 1440 minutes (24 hours). Never clamp to a finite bucket."
				: `Estimated elapsed wall-clock duration is greater than ${index * 15} minutes and at most ${(index + 1) * 15} minutes. Round positive estimates up to this quarter-hour bucket.`,
	]),
);

export const durationInstructions =
	"Estimate wall-clock duration for the user's task from actual context and catalog contracts, including critical path, overhead and human waits where estimable. Round positive estimates up to 15-minute increments; below or exactly 15 minutes uses 15min, exactly 24 elapsed hours uses 1d, anything greater uses >1d. Choose unknown when evidence is insufficient. Estimate inline work too when selecting none. These canonical labels improve granularity, not accuracy: this is an unmeasured estimate, not a guarantee or an execution budget. Never change budget limits.";
