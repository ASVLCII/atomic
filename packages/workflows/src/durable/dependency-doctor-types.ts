export type WorkflowDependencyOperation = "status" | "doctor" | "recover";

export interface WorkflowDependencyReport {
	readonly provider: "managed" | "external" | "docker";
	readonly state: "ready" | "unavailable" | "uninitialized" | "checking" | "recovering";
	readonly checkedAt?: string;
	readonly runtime: {
		readonly executable: string;
		readonly version: string;
		readonly postgresVersion?: string;
		readonly installation?: { readonly executable: string; readonly version: string };
	};
	readonly endpoint?: { readonly host: string; readonly port: number };
	readonly cluster?: {
		readonly version: 1;
		readonly clusterId: string;
		readonly dataDir: string;
		readonly directoryIdentity: string;
		readonly major: number;
		readonly server?: {
			readonly port: number;
			readonly pid: number;
			readonly started: number;
			readonly systemIdentifier: string;
		};
	};
	readonly identityVerified: boolean;
	/** Conservative live leases, including PIDs whose liveness cannot be disproved. */
	readonly consumers: readonly {
		readonly clusterId: string;
		readonly token: string;
		readonly pid: number;
		readonly runtime: string;
	}[];
	readonly lastFailure?: string;
	readonly guidance: string;
}
