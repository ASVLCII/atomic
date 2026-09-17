import type * as Core from "../../src/core/extensions/index.ts";
import type * as Root from "../../src/index.ts";
import type * as Barrel from "../../src/index-extensions.ts";

type Equal<L, R> = (<T>() => T extends L ? 1 : 2) extends <T>() => T extends R ? 1 : 2 ? true : false;
type Assert<T extends true> = T;
type Hooks = [
	Root.AfterProviderResponseEvent,
	Root.ContextEventResult,
	Root.MessageEndEventResult,
	Root.ModelSelectEvent,
	Root.ModelSelectSource,
	Root.ResourcesDiscoverEvent,
	Root.ResourcesDiscoverResult,
	Root.SessionBeforeCompactResult,
	Root.SessionBeforeForkResult,
	Root.SessionBeforeSwitchResult,
	Root.SessionBeforeTreeResult,
	Root.SessionCompactFailedEvent,
	Root.ThinkingLevelSelectEvent,
	Root.ToolResultEventResult,
];
export type CoreIdentity = Assert<
	Equal<
		Hooks,
		[
			Core.AfterProviderResponseEvent,
			Core.ContextEventResult,
			Core.MessageEndEventResult,
			Core.ModelSelectEvent,
			Core.ModelSelectSource,
			Core.ResourcesDiscoverEvent,
			Core.ResourcesDiscoverResult,
			Core.SessionBeforeCompactResult,
			Core.SessionBeforeForkResult,
			Core.SessionBeforeSwitchResult,
			Core.SessionBeforeTreeResult,
			Core.SessionCompactFailedEvent,
			Core.ThinkingLevelSelectEvent,
			Core.ToolResultEventResult,
		]
	>
>;
export type BarrelIdentity = Assert<
	Equal<
		Hooks,
		[
			Barrel.AfterProviderResponseEvent,
			Barrel.ContextEventResult,
			Barrel.MessageEndEventResult,
			Barrel.ModelSelectEvent,
			Barrel.ModelSelectSource,
			Barrel.ResourcesDiscoverEvent,
			Barrel.ResourcesDiscoverResult,
			Barrel.SessionBeforeCompactResult,
			Barrel.SessionBeforeForkResult,
			Barrel.SessionBeforeSwitchResult,
			Barrel.SessionBeforeTreeResult,
			Barrel.SessionCompactFailedEvent,
			Barrel.ThinkingLevelSelectEvent,
			Barrel.ToolResultEventResult,
		]
	>
>;

export function register(api: Root.ExtensionAPI): void {
	api.on("thinking_level_select", (event) => {
		const typed: Root.ThinkingLevelSelectEvent = event;
		void typed;
	});
	api.on("message_end", (): Root.MessageEndEventResult => ({}));
	api.on("context", (): Root.ContextEventResult => ({}));
	api.on("resources_discover", (): Root.ResourcesDiscoverResult => ({}));
}
