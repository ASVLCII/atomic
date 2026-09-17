import { createProvider, envApiKeyAuth, type Provider } from "@bastani/pi-ai";

/** Shares the normal credential lifecycle without registering a chat model or transport. */
export function jevAuthProvider(): Provider {
	return createProvider({
		id: "typesafe-ai",
		name: "TypeSafe Jev",
		auth: { apiKey: envApiKeyAuth("TypeSafe API key", ["TYPESAFE_AI_API_KEY"]) },
		models: [],
		api: {},
	});
}
