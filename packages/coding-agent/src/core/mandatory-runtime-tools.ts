import type { Extension, RegisteredTool, ToolDefinition } from "./extensions/index.js";

const MANDATORY_TOOL_NAMES = new Set(["intercom"]);
const TRUSTED_MANDATORY_DEFINITIONS = new WeakSet<ToolDefinition>();

/** Mark an extension instance loaded through Atomic's internally owned mandatory package path. */
export function markTrustedMandatoryRuntimeExtension(extension: Extension): void {
	extension.sourceInfo = { ...extension.sourceInfo, configurationOrigin: "bundled" };
	for (const registration of extension.tools.values()) {
		registration.sourceInfo = extension.sourceInfo;
		if (MANDATORY_TOOL_NAMES.has(registration.definition.name)) {
			TRUSTED_MANDATORY_DEFINITIONS.add(registration.definition);
		}
	}
	for (const command of extension.commands.values()) command.sourceInfo = extension.sourceInfo;
}

export function isTrustedMandatoryRuntimeTool(registration: RegisteredTool): boolean {
	return (
		MANDATORY_TOOL_NAMES.has(registration.definition.name) &&
		TRUSTED_MANDATORY_DEFINITIONS.has(registration.definition)
	);
}

/** Reserved bundled tool identities for collision handling, not a selection bypass. */
export function isMandatoryRuntimeTool(name: string): boolean {
	return MANDATORY_TOOL_NAMES.has(name);
}
