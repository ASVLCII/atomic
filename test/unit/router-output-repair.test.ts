import assert from "node:assert/strict";
import { afterEach, test, vi } from "vitest";
import { SettingsManager } from "../../packages/coding-agent/src/core/settings-manager.js";
import {
	inferRouterDecision,
	inferStructuredOutput,
} from "../../packages/coding-agent/src/core/structured-output/index.js";
import {
	decisionMessage,
	decisionModel,
	decisionRequest,
	jevResponse,
	messageStream,
} from "../helpers/structured-output.js";

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
	vi.useRealTimers();
});

test("router repairs invalid chat output with sanitized feedback and aggregates usage", async () => {
	const request = decisionRequest();
	const stream = vi
		.fn<typeof request.modelRegistry.streamSimple>()
		.mockImplementationOnce(() => messageStream(decisionMessage({ route: "private-invalid-output" })))
		.mockImplementation(() => messageStream(decisionMessage()));
	request.modelRegistry.streamSimple = stream;
	const result = await inferRouterDecision(request);
	assert.equal(result.value.route, "review");
	assert.equal(stream.mock.calls.length, 2);
	assert.deepEqual(result.usage, { inputTokens: 40, outputTokens: 20 });
	assert.match(stream.mock.calls[1][1].systemPrompt!, /previous response failed output validation/);
	assert.doesNotMatch(JSON.stringify(stream.mock.calls[1]), /private-invalid-output/);
	assert.equal(stream.mock.calls[1][2]?.maxRetries, 0);
	assert.equal(stream.mock.calls[0][2]?.signal, stream.mock.calls[1][2]?.signal);
});

test("router accepts fourth attempt and exhausts after four invalid answers", async () => {
	const request = decisionRequest();
	let count = 0;
	request.modelRegistry.streamSimple = () => messageStream(decisionMessage(++count === 4 ? { route: "review" } : {}));
	await inferRouterDecision(request);
	assert.equal(count, 4);
	count = 0;
	request.modelRegistry.streamSimple = () => {
		count++;
		return messageStream(decisionMessage({}));
	};
	await assert.rejects(inferRouterDecision(request), /exhausted after 4 attempts/);
	assert.equal(count, 4);
});

test("general structured output remains one shot", async () => {
	const request = decisionRequest();
	const stream = vi.fn(() => messageStream(decisionMessage({})));
	request.modelRegistry.streamSimple = stream;
	await assert.rejects(
		inferStructuredOutput({
			...request,
			model: { kind: "chat", fullId: "decision-test/chat", model: decisionModel },
		}),
		/No repair request/,
	);
	assert.equal(stream.mock.calls.length, 1);
});

for (const failure of ["transport", "input", "provider"] as const)
	test(`router does not retry ${failure}`, async () => {
		const request = decisionRequest();
		const stream = vi.fn(() => {
			if (failure === "transport") throw new Error("private-provider-error");
			return messageStream({ ...decisionMessage(), stopReason: "error" });
		});
		request.modelRegistry.streamSimple = stream;
		await assert.rejects(
			inferRouterDecision({ ...request, ...(failure === "input" ? { state: {} } : {}) }),
			(error) => !String(error).includes("private-provider-error"),
		);
		assert.equal(stream.mock.calls.length, failure === "input" ? 0 : 1);
	});

for (const kind of ["missing", "mass", "json"] as const)
	test(`Jev repairs ${kind} output without changing criteria`, async () => {
		vi.stubEnv("TYPESAFE_AI_API_KEY", "synthetic-key");
		const bad = jevResponse();
		if (kind === "missing") Reflect.deleteProperty(bad.answers.route, "probabilities");
		if (kind === "mass") bad.answers.route.probabilities.none = 0;
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(kind === "json" ? new Response("invalid") : Response.json(bad))
			.mockImplementation(async () => Response.json(jevResponse()));
		vi.stubGlobal("fetch", fetch);
		const request = { ...decisionRequest(), settings: SettingsManager.inMemory() };
		const result = await inferRouterDecision(request);
		assert.equal(result.value.route, "review");
		assert.equal(fetch.mock.calls.length, 2);
		const first = JSON.parse(fetch.mock.calls[0][1].body);
		const second = JSON.parse(fetch.mock.calls[1][1].body);
		assert.deepEqual(first.state, second.state);
		assert.deepEqual(first.questions.route.criteria, second.questions.route.criteria);
		assert.match(second.questions.route.instructions, /previous response failed output validation/);
		assert.deepEqual(result.usage, {
			inputTokens: kind === "json" ? 20 : 40,
			outputTokens: kind === "json" ? 10 : 20,
		});
	});

test("Jev HTTP authentication failure does not retry", async () => {
	vi.stubEnv("TYPESAFE_AI_API_KEY", "synthetic-key");
	const fetch = vi.fn(async () => new Response("private", { status: 401 }));
	vi.stubGlobal("fetch", fetch);
	await assert.rejects(
		inferRouterDecision({ ...decisionRequest(), settings: SettingsManager.inMemory() }),
		/HTTP 401/,
	);
	assert.equal(fetch.mock.calls.length, 1);
});

test("cancellation after invalid output prevents repair", async () => {
	const controller = new AbortController();
	const request = decisionRequest();
	const stream = vi.fn(() => {
		controller.abort();
		return messageStream(decisionMessage({}));
	});
	request.modelRegistry.streamSimple = stream;
	await assert.rejects(inferRouterDecision({ ...request, signal: controller.signal }), /cancelled/);
	assert.equal(stream.mock.calls.length, 1);
});

test("repairs share the original deadline even with an uncooperative provider", async () => {
	vi.useFakeTimers();
	const request = decisionRequest();
	let count = 0;
	request.modelRegistry.streamSimple = () => {
		count++;
		if (count === 1) {
			const first = messageStream(decisionMessage({}));
			first.result = () => new Promise((resolve) => setTimeout(() => resolve(decisionMessage({})), 30));
			return first;
		}
		const stream = messageStream(decisionMessage());
		stream.result = () => new Promise(() => {});
		return stream;
	};
	const result = inferRouterDecision({ ...request, timeoutMs: 50 });
	const rejected = assert.rejects(result, /timed out/);
	await vi.advanceTimersByTimeAsync(50);
	await rejected;
	assert.equal(count, 2);
});

test("correlated model effort validation participates in repairs", async () => {
	const request = decisionRequest();
	const stream = vi
		.fn()
		.mockImplementationOnce(() => messageStream(decisionMessage({ route: "none" })))
		.mockImplementation(() => messageStream(decisionMessage({ route: "review" })));
	request.modelRegistry.streamSimple = stream;
	const result = await inferRouterDecision(request, (value) => value.route === "review");
	assert.equal(result.value.route, "review");
	assert.equal(stream.mock.calls.length, 2);
});

test("repairs retain the original state, schema, model and router selection", async () => {
	const request = decisionRequest();
	const state = { ...request.state };
	const originalState = JSON.stringify(request.state);
	const models = [{ ...decisionModel }];
	const getAll = vi.fn(() => models);
	const stream = vi.fn<typeof request.modelRegistry.streamSimple>((model, context) => {
		assert.equal(model.id, "chat");
		assert.equal(JSON.stringify(JSON.parse(String(context.messages[0].content)).state), originalState);
		if (stream.mock.calls.length === 1) {
			models[0].id = "changed";
			state.task = "changed private task";
			return messageStream(decisionMessage({}));
		}
		return messageStream(decisionMessage());
	});
	await inferRouterDecision({
		...request,
		state,
		modelRegistry: { ...request.modelRegistry, getAll, streamSimple: stream },
	});
	assert.equal(getAll.mock.calls.length, 1);
	assert.equal(stream.mock.calls.length, 2);
});

for (const valid of [false, true])
	test(`elapsed deadline rejects synchronous ${valid ? "valid" : "invalid"} output without retry`, async () => {
		let now = 0;
		const clock = vi.spyOn(performance, "now").mockImplementation(() => now);
		try {
			const request = decisionRequest();
			const stream = vi.fn(() => {
				now = 100;
				return messageStream(decisionMessage(valid ? { route: "review" } : {}));
			});
			await assert.rejects(
				inferRouterDecision({
					...request,
					timeoutMs: 50,
					modelRegistry: { ...request.modelRegistry, streamSimple: stream },
				}),
				/timed out/,
			);
			assert.equal(stream.mock.calls.length, 1);
		} finally {
			clock.mockRestore();
		}
	});

test("expired Jev auth cannot start a transport even before the timer callback", async () => {
	let now = 0;
	const clock = vi.spyOn(performance, "now").mockImplementation(() => now);
	const fetch = vi.fn();
	vi.stubGlobal("fetch", fetch);
	try {
		const request = decisionRequest();
		await assert.rejects(
			inferRouterDecision({
				...request,
				timeoutMs: 50,
				settings: SettingsManager.inMemory({ routerModel: "typesafe-ai/jev" }),
				modelRegistry: {
					...request.modelRegistry,
					getProviderAuth: async () => {
						now = 100;
						return { auth: { apiKey: "synthetic-key" } };
					},
				},
			}),
			/timed out/,
		);
		assert.equal(fetch.mock.calls.length, 0);
	} finally {
		clock.mockRestore();
	}
});
