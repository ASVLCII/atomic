// #3090 / #3089: shared Jev overflow routing through the public decision API and fake HTTP transport.
import assert from "node:assert/strict";
import { Type } from "typebox";
import { afterEach, test, vi } from "vitest";
import { inferRouterDecision } from "../../packages/coding-agent/src/core/structured-output/index.js";
import { type JevFixtureRequest, jevFixtureResponse } from "../helpers/jev-tournament.js";
import { decisionRequest } from "../helpers/structured-output.js";

afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

test("small Jev questions share one direct request despite oversized unchanged state", async () => {
	vi.stubEnv("TYPESAFE_AI_API_KEY", "fixture-key");
	const request = tournament(2);
	const state = { text: "x".repeat(128000) };
	const questions = { workflow: request.jev.questions.pick, budget: request.jev.questions.pick };
	const calls: JevFixtureRequest[] = [];
	vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
		const body = JSON.parse(String(init.body)) as JevFixtureRequest;
		calls.push(body);
		return Response.json(jevFixtureResponse(body));
	});
	await inferRouterDecision({ ...request, state, jev: { ...request.jev, questions } });
	assert.equal(calls.length, 1);
	assert.deepEqual(calls[0].state, state);
	assert.deepEqual(Object.keys(calls[0].questions), ["workflow", "budget"]);
});

test("singleton Jev decoder receives an ordinary object", async () => {
	vi.stubEnv("TYPESAFE_AI_API_KEY", "fixture-key");
	vi.stubGlobal("fetch", async (_url: string, init: RequestInit) =>
		Response.json(jevFixtureResponse(JSON.parse(String(init.body)))),
	);
	const request = tournament(1);
	await inferRouterDecision({
		...request,
		jev: {
			...request.jev,
			decode: (choices) => {
				const ownMethod: unknown = Reflect.get(choices, "hasOwnProperty");
				assert.ok(typeof ownMethod === "function");
				assert.equal(ownMethod.call(choices, "pick"), true);
				assert.equal(Object.getPrototypeOf(choices), Object.prototype);
				return { ...choices };
			},
		},
	});
});

test("mixed Jev decoder preserves original question order and unusual keys", async () => {
	vi.stubEnv("TYPESAFE_AI_API_KEY", "fixture-key");
	vi.stubGlobal("fetch", async (_url: string, init: RequestInit) =>
		Response.json(jevFixtureResponse(JSON.parse(String(init.body)))),
	);
	const request = tournament(256);
	const criteria = Object.fromEntries([
		["__proto__", "Prototype"],
		["constructor", "Constructor"],
		["hasOwnProperty", "Own"],
		...Object.entries(request.jev.questions.pick.criteria),
	]);
	const questions = Object.fromEntries([
		["large", { instructions: "Choose", criteria }],
		["__proto__", { instructions: "Choose", criteria: { constructor: "Constructor" } }],
	]);
	const result = await inferRouterDecision({
		...request,
		jev: {
			questions,
			decode: (choices) => {
				assert.deepEqual(Object.keys(choices), Object.keys(questions));
				assert.equal(Object.getPrototypeOf(choices), Object.prototype);
				return { ...choices };
			},
		},
	});
	assert.equal(result.value.large, "__proto__");
	assert.equal(Object.getOwnPropertyDescriptor(result.value, "__proto__")?.value, "constructor");
});

test("Jev routes all 1997 original options through bounded batches and a shared final", async () => {
	vi.stubEnv("TYPESAFE_AI_API_KEY", "fixture-key");
	const criteria = Object.fromEntries(Array.from({ length: 1997 }, (_, i) => [`key_${i}`, `Candidate ${i}`]));
	const calls: string[][][] = [];
	vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
		const body = JSON.parse(String(init.body)) as { questions: Record<string, { criteria: Record<string, string> }> };
		calls.push(Object.values(body.questions).map((q) => Object.keys(q.criteria)));
		return Response.json({
			model: "jev-test",
			usage: { input_tokens: 20, output_tokens: 10 },
			answers: Object.fromEntries(
				Object.entries(body.questions).map(([id, q]) => {
					const keys = Object.keys(q.criteria);
					assert.ok(keys.length <= 255);
					return [
						id,
						{
							type: "choice",
							choice: keys[0],
							confidence: 1,
							probabilities: Object.fromEntries(keys.map((k) => [k, 1 / keys.length])),
						},
					];
				}),
			),
		});
	});
	const result = await inferRouterDecision({
		...decisionRequest(),
		settings: { getRouterModel: () => "typesafe-ai/jev" },
		schema: Type.Object({ picked: Type.String() }),
		jev: {
			questions: { pick: { instructions: "Select a candidate", criteria } },
			decode: (choices) => ({ picked: choices.pick }),
		},
	});
	assert.equal(result.value.picked, "key_0");
	assert.deepEqual(calls[0].flat(), Object.keys(criteria));
	assert.deepEqual(
		calls.at(-1)?.flat(),
		Array.from({ length: 8 }, (_, i) => [0, 1, 2].map((j) => `key_${i * 255 + j}`)).flat(),
	);
	assert.deepEqual(result.usage, { inputTokens: calls.length * 20, outputTokens: calls.length * 10 });
	assert.equal(calls.length, 2);
});

test("mixed named questions cannot collide with tournament IDs", async () => {
	vi.stubEnv("TYPESAFE_AI_API_KEY", "fixture-key");
	const criteria = Object.fromEntries(Array.from({ length: 256 }, (_, i) => [`key_${i}`, `Candidate ${i}`]));
	vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
		const { questions } = JSON.parse(String(init.body)) as {
			questions: Record<string, { criteria: Record<string, string> }>;
		};
		return Response.json({
			model: "jev-test",
			usage: { input_tokens: 1, output_tokens: 1 },
			answers: Object.fromEntries(
				Object.entries(questions).map(([id, q]) => {
					const keys = Object.keys(q.criteria);
					return [
						id,
						{
							type: "choice",
							choice: keys[0],
							confidence: 1,
							probabilities: Object.fromEntries(keys.map((k) => [k, 1 / keys.length])),
						},
					];
				}),
			),
		});
	});
	const result = await inferRouterDecision({
		...decisionRequest(),
		settings: { getRouterModel: () => "typesafe-ai/jev" },
		schema: Type.Record(Type.String(), Type.String()),
		jev: {
			questions: {
				large: { instructions: "Select", criteria },
				q0: { instructions: "Preserve", criteria: { preserve: "Preserve budget" } },
			},
			decode: (choices) => ({ ...choices }),
		},
	});
	assert.deepEqual(result.value, { large: "key_0", q0: "preserve" });
});

test("retained final option participates originally but does not replace batch top three", async () => {
	vi.stubEnv("TYPESAFE_AI_API_KEY", "fixture-key");
	const criteria = Object.fromEntries(Array.from({ length: 256 }, (_, i) => [`key_${i}`, `Candidate ${i}`]));
	const calls: string[][][] = [];
	vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
		const { questions } = JSON.parse(String(init.body)) as {
			questions: Record<string, { criteria: Record<string, string> }>;
		};
		calls.push(Object.values(questions).map((q) => Object.keys(q.criteria)));
		return Response.json({
			model: "jev-test",
			usage: { input_tokens: 1, output_tokens: 1 },
			answers: Object.fromEntries(
				Object.entries(questions).map(([id, q]) => {
					const keys = Object.keys(q.criteria);
					const winner = calls.length === 1 ? keys[0] : "key_200";
					return [
						id,
						{
							type: "choice",
							choice: winner,
							confidence: 1,
							probabilities: Object.fromEntries(keys.map((k) => [k, k === winner ? 1 : 0])),
						},
					];
				}),
			),
		});
	});
	const result = await inferRouterDecision({
		...decisionRequest(),
		settings: { getRouterModel: () => "typesafe-ai/jev" },
		schema: Type.Record(Type.String(), Type.String()),
		jev: {
			questions: { pick: { instructions: "Select", criteria, retainForFinal: "key_200" } },
			decode: (choices) => ({ ...choices }),
		},
	});
	assert.equal(result.value.pick, "key_200");
	assert.deepEqual(calls[0].flat(), Object.keys(criteria));
	assert.deepEqual(calls[1].flat(), ["key_0", "key_1", "key_2", "key_200", "key_255"]);
});

function tournament(count: number) {
	const criteria = Object.fromEntries(Array.from({ length: count }, (_, i) => [`key_${i}`, `Candidate ${i}`]));
	return {
		...decisionRequest(),
		settings: { getRouterModel: () => "typesafe-ai/jev" },
		schema: Type.Record(Type.String(), Type.String()),
		jev: {
			questions: { pick: { instructions: "Select", criteria } },
			decode: vi.fn((choices: Readonly<Record<string, string>>) => ({ ...choices })),
		},
	};
}

for (const count of [0, 1, 255, 256, 22000]) {
	test(`Jev ${count} candidates terminate without dropping first-round participants`, async () => {
		vi.stubEnv("TYPESAFE_AI_API_KEY", "fixture-key");
		const request = tournament(count);
		const calls: JevFixtureRequest[] = [];
		vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
			const body = JSON.parse(String(init.body)) as JevFixtureRequest;
			calls.push(body);
			for (const q of Object.values(body.questions)) assert.ok(Object.keys(q.criteria).length <= 255);
			return Response.json(jevFixtureResponse(body));
		});
		if (!count) {
			await assert.rejects(inferRouterDecision(request), /nonempty/);
			assert.equal(calls.length, 0);
			return;
		}
		assert.equal((await inferRouterDecision(request)).value.pick, "key_0");
		const seen = new Set(
			calls.flatMap((call) => Object.values(call.questions).flatMap((q) => Object.keys(q.criteria))),
		);
		assert.deepEqual([...seen], Object.keys(request.jev.questions.pick.criteria));
		assert.ok(calls.length >= (count <= 255 ? 1 : count <= 1997 ? 2 : 3));
		assert.ok(calls.length <= Math.ceil(count / 255) + 3);
		assert.equal(request.jev.decode.mock.calls.length, 1);
	});
}

test("invalid retained key rejects before transport", async () => {
	vi.stubEnv("TYPESAFE_AI_API_KEY", "fixture-key");
	const request = tournament(256);
	const fetch = vi.fn();
	vi.stubGlobal("fetch", fetch);
	await assert.rejects(
		inferRouterDecision({
			...request,
			jev: { ...request.jev, questions: { pick: { ...request.jev.questions.pick, retainForFinal: "absent" } } },
		}),
		/retainForFinal/,
	);
	assert.equal(fetch.mock.calls.length, 0);
});

for (const failure of [
	"missing",
	"extra",
	"negative",
	"nonfinite",
	"winner",
	"mass",
	"missing-answer",
	"extra-answer",
	"http",
] as const) {
	test(`overflow ${failure} fails without partial decode or retry`, async () => {
		vi.stubEnv("TYPESAFE_AI_API_KEY", "fixture-key");
		const request = tournament(256);
		const fetch = vi.fn(async (_url: string, init: RequestInit) => {
			const body = JSON.parse(String(init.body)) as JevFixtureRequest;
			const response = jevFixtureResponse(body);
			const answer = Object.values(response.answers)[0]!;
			const key = Object.keys(answer.probabilities)[0]!;
			if (failure === "missing") delete answer.probabilities[key];
			if (failure === "extra") answer.probabilities.absent = 0;
			if (failure === "negative") answer.probabilities[key] = -1;
			if (failure === "nonfinite") answer.probabilities[key] = NaN;
			if (failure === "winner") answer.choice = "absent";
			if (failure === "mass") answer.probabilities[key] = 0.5;
			if (failure === "missing-answer") delete response.answers[Object.keys(response.answers)[0]!];
			if (failure === "extra-answer") response.answers.absent = answer;
			return failure === "http" ? new Response("private", { status: 422 }) : Response.json(response);
		});
		vi.stubGlobal("fetch", fetch);
		await assert.rejects(inferRouterDecision(request), /Malformed|HTTP 422/);
		assert.equal(fetch.mock.calls.length, 1);
		assert.equal(request.jev.decode.mock.calls.length, 0);
	});
}

for (const failure of ["cancel-before", "cancel-between", "timeout", "provider"] as const) {
	test(`overflow ${failure} rejects the whole operation`, async () => {
		vi.useFakeTimers();
		vi.stubEnv("TYPESAFE_AI_API_KEY", "fixture-key");
		const request = tournament(256);
		const controller = new AbortController();
		if (failure === "cancel-before") controller.abort();
		const fetch = vi.fn(async (_url: string, init: RequestInit) => {
			if (fetch.mock.calls.length === 2) {
				if (failure === "provider") return new Response("private", { status: 529 });
				return new Promise<Response>(() => {});
			}
			const body = JSON.parse(String(init.body)) as JevFixtureRequest;
			if (failure === "cancel-between") controller.abort();
			return Response.json(jevFixtureResponse(body));
		});
		vi.stubGlobal("fetch", fetch);
		const rejected = assert.rejects(
			inferRouterDecision({ ...request, signal: controller.signal, timeoutMs: 50 }),
			/abort|cancel|timed out|HTTP 529/i,
		);
		await vi.advanceTimersByTimeAsync(50);
		await rejected;
		assert.equal(request.jev.decode.mock.calls.length, 0);
		assert.equal(fetch.mock.calls.length, failure === "cancel-before" ? 0 : failure === "cancel-between" ? 1 : 2);
		vi.useRealTimers();
	});
}

test("context packing repeats unchanged state, limits estimated question context, and sums actual calls", async () => {
	vi.stubEnv("TYPESAFE_AI_API_KEY", "fixture-key");
	const request = tournament(1000);
	request.state = { task: "x".repeat(40000) };
	request.jev.questions.pick.criteria = Object.fromEntries(
		Object.keys(request.jev.questions.pick.criteria).map((key) => [key, "description ".repeat(200)]),
	);
	const calls: JevFixtureRequest[] = [];
	vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
		const body = JSON.parse(String(init.body)) as JevFixtureRequest;
		calls.push(body);
		assert.deepEqual(body.state, request.state);
		assert.ok((JSON.stringify(body.state).length + JSON.stringify(body.questions).length) / 4 <= 64000);
		for (const question of Object.values(body.questions))
			assert.ok((JSON.stringify(body.state).length + JSON.stringify(question).length) / 4 <= 32000);
		return Response.json(jevFixtureResponse(body));
	});
	const result = await inferRouterDecision(request);
	assert.equal(result.value.pick, "key_0");
	assert.ok(calls.length > 2);
	assert.deepEqual(result.usage, { inputTokens: calls.length * 20, outputTokens: calls.length * 10 });
	assert.equal(
		new Set(calls.flatMap((call) => Object.values(call.questions).flatMap((q) => Object.keys(q.criteria)))).size,
		1000,
	);
});

for (const status of [200, 422]) {
	test(`estimated oversized unchanged state is sent once and provider ${status} is authoritative`, async () => {
		vi.stubEnv("TYPESAFE_AI_API_KEY", "fixture-key");
		const request = { ...tournament(1), state: { task: "x".repeat(300000) } };
		const fetch = vi.fn(async (_url: string, init: RequestInit) => {
			const body = JSON.parse(String(init.body)) as JevFixtureRequest;
			assert.deepEqual(body.state, request.state);
			return status === 200 ? Response.json(jevFixtureResponse(body)) : new Response("private", { status });
		});
		vi.stubGlobal("fetch", fetch);
		if (status === 200) assert.equal((await inferRouterDecision(request)).value.pick, "key_0");
		else await assert.rejects(inferRouterDecision(request), /HTTP 422/);
		assert.equal(fetch.mock.calls.length, 1);
	});
}

test("minimum context batches still shrink with a retained option and singleton tails", async () => {
	vi.stubEnv("TYPESAFE_AI_API_KEY", "fixture-key");
	const request = tournament(256);
	const calls: JevFixtureRequest[] = [];
	vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
		const body = JSON.parse(String(init.body)) as JevFixtureRequest;
		calls.push(body);
		return Response.json(jevFixtureResponse(body, (keys) => keys.find((key) => key !== "key_200") ?? keys[0]!));
	});
	await inferRouterDecision({
		...request,
		state: { task: "x".repeat(127950) },
		jev: { ...request.jev, questions: { pick: { ...request.jev.questions.pick, retainForFinal: "key_200" } } },
	});
	const final = calls.at(-1)!.questions.pick;
	assert.ok(final);
	assert.ok(Object.keys(final.criteria).length <= 4);
	assert.ok(Object.hasOwn(final.criteria, "key_200"));
	assert.ok(calls.length < 200);
});

test("multiple overflowing questions preserve original keys independently", async () => {
	vi.stubEnv("TYPESAFE_AI_API_KEY", "fixture-key");
	const request = tournament(256);
	const other = Object.fromEntries(
		Object.keys(request.jev.questions.pick.criteria).map((key) => [`other_${key}`, key]),
	);
	vi.stubGlobal("fetch", async (_url: string, init: RequestInit) =>
		Response.json(jevFixtureResponse(JSON.parse(String(init.body)) as JevFixtureRequest)),
	);
	const result = await inferRouterDecision({
		...request,
		jev: {
			...request.jev,
			questions: { ...request.jev.questions, q0: { instructions: "Choose separately", criteria: other } },
		},
	});
	assert.deepEqual(result.value, { pick: "key_0", q0: "other_key_0" });
});
