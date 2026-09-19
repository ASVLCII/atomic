import { existsSync, readFileSync } from "node:fs";
import { APP_NAME } from "@bastani/atomic";
import { findReadableConfigPath } from "./config-paths.ts";
import { createOwnerState } from "./owner-state.js";

const CONFIG_PATH = findReadableConfigPath();
const ALLOW_BROWSER_COOKIES_ENV = `${APP_NAME.toUpperCase()}_ALLOW_BROWSER_COOKIES`;

interface GeminiWebConfig {
	chromeProfile?: string;
	allowBrowserCookies?: boolean;
}

export function normalizeChromeProfile(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	const normalized = value.trim();
	return normalized.length > 0 ? normalized : undefined;
}

const loadConfig = createOwnerState<GeminiWebConfig>(() => {
	if (!existsSync(CONFIG_PATH)) return {};

	const rawText = readFileSync(CONFIG_PATH, "utf-8");
	let raw: { chromeProfile?: unknown; allowBrowserCookies?: unknown };
	try {
		raw = JSON.parse(rawText) as { chromeProfile?: unknown; allowBrowserCookies?: unknown };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		throw new Error(`Failed to parse ${CONFIG_PATH}: ${message}`);
	}

	return {
		chromeProfile: normalizeChromeProfile(raw.chromeProfile),
		allowBrowserCookies: raw.allowBrowserCookies === true,
	};
});

export function getChromeProfileFromConfig(): string | undefined {
	return loadConfig().chromeProfile;
}

export function isBrowserCookieAccessAllowed(): boolean {
	if (process.env[ALLOW_BROWSER_COOKIES_ENV] === "1") {
		return true;
	}
	return loadConfig().allowBrowserCookies === true;
}
