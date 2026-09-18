import { resolve } from "node:path";
import type { CreateAgentSessionOptions } from "./sdk-types.ts";

/** Internal owner-bound adapter seam. Does not admit work or transfer parent authority. */
export type ChildSessionOptionsResolver = (options: CreateAgentSessionOptions) => CreateAgentSessionOptions;

export function inheritChildSessionOptions(
	parent: CreateAgentSessionOptions,
	child: CreateAgentSessionOptions,
): CreateAgentSessionOptions {
	const builtins = { ...parent.builtins, ...child.builtins };
	for (const name of ["workflows", "subagents", "mcp", "web-access", "intercom"] as const) {
		if (parent.builtins?.[name] === false) builtins[name] = false;
	}
	const ceiling = parent.noTools === "all" ? [] : parent.tools;
	const tools =
		ceiling === undefined ? child.tools : (child.tools ?? ceiling).filter((name) => ceiling.includes(name));
	const parentGate = parent.isFallbackModelAllowed;
	const childGate = child.isFallbackModelAllowed;
	return {
		...parent,
		...child,
		cwd: resolve(parent.cwd!, child.cwd ?? "."),
		builtins,
		tools,
		excludedTools: [...(parent.excludedTools ?? []), ...(child.excludedTools ?? [])],
		noTools: parent.noTools === "all" ? "all" : (child.noTools ?? parent.noTools),
		extensionBindings: { ...parent.extensionBindings, ...child.extensionBindings },
		isFallbackModelAllowed:
			parentGate && childGate
				? (model, effort) => parentGate(model, effort) && childGate(model, effort)
				: (parentGate ?? childGate),
	};
}
