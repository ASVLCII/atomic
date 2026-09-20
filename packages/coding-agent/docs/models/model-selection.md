---
title: "Model Selection"
description: "Practical guidance for choosing models by workflow role, grounded in live coding-agent benchmarks (DeepSWE) and intelligence benchmarks (Artificial Analysis)."
---

# Model Selection

Use this page to choose models for workflow roles:

- Which model should a workflow use by default?
- Which model should it use for judgment gates, debugging, planning, research, cheap worker loops, and fallback diversity?
- Which models are dominated on cost/accuracy and should be avoided unless they have a specific role fit?

This is a **static reference**, not a live benchmark query. [Automatic model selection](/subagents/reference#automatic-model-selection), the default for builtin workflows and subagents, uses compact policy and benchmark records shipped with your installed Atomic version, together with the current available model catalog. Treat the recommendations as a starting point and validate against your own task evaluations.

<Note>
The table below uses the [DeepSWE](https://deepswe.datacurve.ai/) v1.1 snapshot of 113 tasks, updated **September 3, 2026**, at each model's highest published effort. It reports `pass@1` and average dollars per task. The site's default **Best** view instead selects each model's best-scoring effort; four rows differ, as noted below. Treat live leaderboards as authoritative when prices or results change. See [Evals](/models/evals). **Last compiled: 2026-09-03.**
</Note>

Artificial Analysis uses a separate **2026-09-08** retrieval of the **September 7 Intelligence Index v4.3** revision. The DeepSWE table remains the **September 3** snapshot, not a September 8 remeasurement.

## Automatic subagent routing

With `model: "auto"`, Atomic uses compact role guidance and dated benchmark records for eligible models, not the full text or charts of this guide and [Evals](/models/evals). You do not need to attach either guide. It does not browse leaderboards or probe providers during routing. The decision must use a current eligible provider/model and a supported effort; benchmark rows cannot add unavailable models or imply credentials work. The [`routerModel`](/settings#routermodel) setting selects the inference provider, separately from the child model it chooses. For interactive model-choice advice, use the live-source process below.

## Answering model-choice questions

For any task-specific model recommendation, not just workflow authoring, read the [task-type picker](/models/evals#pick-by-task-type) and its per-benchmark charts, then consult [Artificial Analysis](https://artificialanalysis.ai/) for the relevant live evaluation and methodology. Recommend a task-fit candidate and explain the cost or latency tradeoff. Cite the benchmark version, retrieval date and exact model/effort configuration. An aggregate leaderboard winner is not a winner on every task.

If live results cannot be retrieved, use the dated docs snapshot and say it was not refreshed. Check the configured catalog before suggesting an exact provider/model ID or effort level; catalog presence does not prove live access. Keep benchmark measurement settings separate from production effort recommendations.

## Benchmark levels are measurement settings

The thinking level in brackets in the chart is the **measurement configuration used for that benchmark result**, not a universal workflow default. A score measured at `max` does not mean every stage using that model should use `max`; benchmark model identity and production thinking effort are separate choices. When authoring a workflow, choose effort from the stage role and cost of being wrong, then check the returned `availableThinkingLevels` for the configured catalog model.

Practical default: use `low` or `medium` for coding, and `high` or `xhigh` for code review, test design and failure analysis, subject to catalog support. Run actual tests as tool calls. `max` is usually overkill and is not preferred in practice. These are starting recommendations to validate on your workflow, not a claim that lower effort reproduces the benchmark scores below.

## Pin model identity

When a workflow needs an exact model, call `workflow({ action: "models" })` and pin a returned `fullId`. Do not pin a
bare model ID: the same exact model ID can belong to more than one provider. For a bare exact `--model` ID, Atomic
uses the sole matching provider with configured authentication; if none or more than one match is authenticated, it
reports the ambiguity. Use `--provider <provider> --model <id>` or `--model <provider>/<id>` to choose explicitly.

## AA cross-check for current candidates

These are selected candidates, not a replacement DeepSWE frontier. The [AA leaderboard](https://artificialanalysis.ai/leaderboards/models) was retrieved **2026-09-08** under Intelligence Index **v4.3**, announced **2026-09-07**. Scores are index points, not pass percentages; cost is weighted USD per **AA Intelligence Index task**, not DeepSWE cost. Speed uses the default 10k-input workload in standardized output tokens per second, not full-task latency. The source has no separate publication timestamp for these measurements.

| Model and AA measurement configuration | Intelligence Index | AA $/task | Output tokens/s | Candidate role and tradeoff |
| --- | --- | --- | --- | --- |
| [Claude Fable 5.1, max with default fallback](https://artificialanalysis.ai/models/claude-fable-5-1) | 53 | $7.63 | 69 | Knowledge-work planning candidate; xhigh also displays 53 at $5.98 per task |
| [GPT-6 Astra, max](https://artificialanalysis.ai/models/gpt-6-astra) | 53 | $3.26 | 62 | Terminal and document-reasoning candidate; xhigh displays 53 at $2.31 and scores higher on those two individual evaluations |
| [Gemini 3.8 Flash, high](https://artificialanalysis.ai/models/gemini-3-8-flash) | 41 | $1.24 | 286 | Strong historical Datacurve result, but only 20% on the new Terminal-Bench v4.0; check the intended task distribution |
| [GPT-5.6 Luna, max](https://artificialanalysis.ai/models/gpt-5-6-luna) | 38 | $0.18 | 121 | Budget long-context candidate with verification; 12% on Terminal-Bench v4.0 |

AA's [v4.3 announcement](https://artificialanalysis.ai/articles/artificial-analysis-intelligence-index-v4-3) replaces 𝜏³-Banking with AutomationBench-AA and Terminal-Bench v2.1 with v4.0. Fable 5.1 max with default fallback scores 58% normalized Elo on AA-Briefcase and 63% on GDPval-AA v2, versus Astra max at 53% and 54%. These are transformed Elo displays, **not pass rates**. Astra xhigh scores 32% GDP.pdf All-pass and 60% Terminal-Bench v4.0; Astra max scores 31% and 59%. Use the [per-evaluation tables](/models/evals#per-evaluation-scores-for-catalog-models) and [task-type picker](/models/evals#pick-by-task-type), not an aggregate rank. A rounded lead does not establish statistical significance, security-review reliability or the best model for every role. Fable's default-fallback result is not evidence for an arbitrary no-fallback configuration.

The separate [Coding Agent Index v1.4](https://artificialanalysis.ai/agents/coding-agents), retrieved 2026-09-08, still uses Terminal-Bench v2.1 alongside DeepSWE and SWE-Atlas-QnA. It reports Claude Code + Fable 5.1 max with fallback at **70**, **$9.18/task** and **24.0 minutes/task**, Opencode + Gemini 3.8 Flash high at **61**, **$2.04/task** and **11.9 minutes/task**, and Codex + Luna max at **57**, **$0.29/task** and **8.0 minutes/task**. These are named-agent runs, not Atomic or interchangeable base-model results. All fourteen rows are in [Evals](/models/evals#coding-agent-index-v1-4-is-a-different-comparison). Fable 5.1 remains absent from the separately dated Datacurve snapshot below.

## Recommendation chart

The current highest-effort-config Pareto frontier is **gemini-3.8-flash** (accuracy ceiling), **gpt-5.6-luna**, and **glm-5.3-flash** (cheapest point). It collapsed from five members to three when Gemini 3.8 Flash landed on September 1, 2026: at 73.83% unrounded it edges out claude-opus-5's 73.65% — both display 74% — for $2.36 against $11.84, which pushes claude-opus-5, gpt-5.6-sol, and glm-5.3 off the frontier. Everything else displayed on the live DeepSWE leaderboard is dominated on cost and accuracy and earns a place only through role fit or provider diversity. For the frontier reasoning, see [Pareto Efficiency](/models/pareto-efficiency).

| Model [benchmark measurement level] | pass@1 | $/task | Verdict | Use it for |
| --- | --- | --- | --- | --- |
| gemini-3.8-flash [high] | 74% | $2.36 | Frontier — accuracy ceiling and best value | Judgment gates, hard debugging, and any role that wants top accuracy without top-tier cost; budget for 166 average steps and 143k output tokens per task |
| claude-opus-5 [max] | 74% | $11.84 | Dominated — top-tier role fit | Final approval and the hardest debugging when Anthropic-family behavior is specifically wanted; it matches Gemini 3.8 Flash's rounded 74% but costs $9.48 more per task |
| gpt-6-astra [max] | 73% | $12.37 | Dominated — new arrival | Added September 3, 2026 at DeepSWE's expected launch pricing rather than billed rates; its 28 average steps are the fewest of any row in this table, but Opus 5 scores higher for less |
| gpt-5.6-sol [max] | 73% | $6.46 | Near-peer, no longer on the frontier | High-cost judgment gates where OpenAI-family behavior is wanted; still about half Opus 5's task cost, but Gemini 3.8 Flash is more accurate at just over a third of Sol's task cost |
| gpt-5.6-terra [max] | 70% | $3.96 | Historical — outside the default selection | Last published measurement, re-verified unchanged in the September 3, 2026 artifact; DeepSWE deselects it by default, so re-enable it on the live page before relying on it |
| claude-fable-5 [max] | 70% | $21.63 | Drop | Sol matches or beats its score for much less, and Gemini 3.8 Flash is four rounded points better for about a ninth of the task cost |
| glm-5.3 [max] | 69% | $3.99 | Best open-weights value, off the frontier | Best open-weights mid-tier cost/accuracy point; matches Kimi K3's rounded score for less, though Gemini 3.8 Flash is five rounded points better for $1.63 less |
| kimi-k3 [max] | 69% | $4.65 | Dominated | GLM-5.3 matches its rounded score for $0.66 less; Moonshot-family diversity only |
| gpt-5.6-luna [max] | 67% | $0.61 | Frontier — cheapest broadly-capable point | Research, orchestration, workers, and code simplification |
| gpt-5.5 [xhigh] | 67% | $7.23 | Superseded | Luna matches its score for less than one tenth of the task cost |
| grok-4.6 [xhigh] | 67% | $5.50 | Provider fallback | xAI diversity; Luna has the same rounded score at lower DeepSWE task cost |
| gemini-3.7-flash [high] | 65% | $2.18 | Provider fallback | Strong Google-family result, but Luna is cheaper and more accurate, and Gemini 3.8 Flash supersedes it inside the Google family at 74% for $2.36 |
| glm-5.3-flash [max] | 63% | $0.24 | Frontier — cheapest | Budget worker loops that can accept lower accuracy and 123 average steps |
| deepseek-v4-pro [max] | 63% | $1.67 | Dominated / provider fallback | DeepSeek diversity only; GLM-5.3 Flash has a higher unrounded score, fewer steps, and about one seventh of the cost |
| claude-opus-4.8 [max] | 59% | $13.22 | Fallback only | Anthropic diversity and long-context behavior, not cost efficiency |
| qwen3.8-max [xhigh] | 57% | $3.73 | Provider fallback | Qwen diversity only; GLM-5.3 Flash and Luna dominate it |
| muse-spark-1.2 [xhigh] | 55% | $3.70 | Drop | GLM-5.3 Flash is cheaper and more accurate |
| claude-sonnet-5 [max] | 54% | $26.40 | Drop everywhere | Highest task cost and 268 average steps for a mid-table score |
| grok-4.5 [high] | 54% | $2.42 | Historical — outside the default selection | Last published measurement, re-verified unchanged; superseded by Grok 4.6 and dominated by current frontier models |
| deepseek-v4-flash [max] | 53% | $0.46 | Dominated / provider fallback | DeepSeek diversity only; GLM-5.3 Flash is ten points more accurate for about half the cost |
| muse-spark-1.1 [xhigh] | 53% | $2.36 | Historical — outside the default selection | Last published measurement, re-verified unchanged; replaced by Muse Spark 1.2 and dominated by current frontier models |
| gpt-5.4 [xhigh] | 52% | $5.65 | Historical — outside the default selection | Last published measurement, re-verified unchanged; Luna is cheaper and 15 points more accurate |
| gemini-3.6-flash [high] | 47% | $2.21 | Drop from reasoning | Superseded by Gemini 3.7 Flash |
| glm-5.2 [max] | 44% | $3.92 | Superseded | Measured predecessor only; do not relabel this as GLM-5.3 |
| gemini-3.5-flash [high] | 36% | $3.45 | Drop from reasoning | Retain only where a low-effort retrieval role has separate evidence |
| kimi-k2.7-code | 31% | $2.82 | Historical — outside the default selection | Last published measurement had no effort level; Kimi K3 is the current family fallback |
| claude-sonnet-4.6 [high] | 30% | $5.52 | Historical — outside the default selection | Last published measurement, re-verified unchanged; removed from all chains |
| gemini-3.1-pro-preview [high] | 12% | $2.14 | Historical — outside the default selection | Last published measurement, re-verified unchanged; the live page labels it `gemini-3.1-pro`; removed from all chains |

<Note>
The DeepSWE values use the September 3, 2026 v1.1 snapshot, including the August 21 pricing corrections for GPT-5.6 Sol and DeepSeek V4.

- Sol's cost reflects OpenAI's promotional input and output price cut through at least November 21, 2026. DeepSWE uses DeepSeek's peak rates; off-peak rates are half as much.
- GPT-6 Astra's DeepSWE costs use expected launch prices, not billed rates. This caveat does not apply to the separately sourced AA costs above.
- `pass@1` is rounded as on the live leaderboard; confidence intervals are omitted here. The top three rows span less than a point unrounded, well inside DeepSWE's published run-to-run intervals. Read a one-row lead as a tie.
- Highest published effort is a measurement choice, not a production default. DeepSWE shows effort saturation: GPT-6 Astra, Claude Fable 5, Grok 4.6, and Gemini 3.7 Flash score best below their highest effort. Its default "Best" view therefore shows `gpt-6-astra [xhigh]` at 74% for \$6.52 with 29 average steps, `claude-fable-5 [xhigh]` at 70% for \$13.41, `grok-4.6 [medium]` at 67% for \$3.45, and `gemini-3.7-flash [medium]` at 65% for \$2.03.
- Seven configurations are excluded from DeepSWE's default selection, not withdrawn: GPT-5.6 Terra, Grok 4.5, Muse Spark 1.1, GPT-5.4, Kimi K2.7 Code, Claude Sonnet 4.6, and Gemini 3.1 Pro Preview. Their last published values were re-verified unchanged against the September 3 artifact. Re-enable them in the site's model picker to inspect them.

Atomic ships GPT-6 Astra through its built-in OpenAI, OpenAI Codex, and Amazon Bedrock catalogs. A benchmark row does not prove account access. Run `workflow({ action: "models" })` or `--list-models` before pinning a model. See the live page for intervals, output tokens, steps, lower-effort configurations, and later corrections.
</Note>

<Note>
**Claude Fable 5.1 is in Atomic's catalog and is not in the DeepSWE table above.** It was released September 1, 2026 and is absent from the September 3, 2026 Datacurve DeepSWE snapshot, so it has no measured `pass@1` or `$/task` in that snapshot. It does have AA Intelligence Index and Coding Agent Index measurements, described above. Do not read the `claude-fable-5` row as a Fable 5.1 result or transfer its score. Evaluate Fable 5.1 on your own workflow before promoting it into a stage.

What is source-backed for `claude-fable-5-1` today, from [Anthropic's model overview](https://platform.claude.com/docs/en/models/fable-5-1/overview): a 1M-token context window and 128K maximum output; adaptive thinking that is always on, with effort `low`, `medium`, `high`, `xhigh`, and `max` and an Anthropic default of `high`; a June 2026 knowledge cutoff; and $10 input, $50 output, $12.50 five-minute cache write, $20 one-hour cache write, and $0.25 cache read per million tokens. The cache read is a quarter of Fable 5's $1.00, which is the main pricing reason to prefer it for long agentic sessions that re-read a cached prefix. Non-default `temperature`, `top_p`, and `top_k` return a 400 on every request, so Atomic omits `temperature` for this model.

At this snapshot, Fable 5.1 is listed through Anthropic, GitHub Copilot, three Bedrock profiles (`anthropic.`, `global.`, `us.`), OpenRouter, and Vercel AI Gateway. Run `workflow({ action: "models" })` or `--list-models` for your current catalog; Copilot access depends on account policy. A latest alias such as `~anthropic/claude-fable-latest` may change targets, so pin a version when model identity matters.

Atomic does not currently offer Claude through Google Vertex, Google Vertex (Anthropic), Azure, or Azure Cognitive Services. Preserved-thinking handling applies only to first-party `anthropic` on `anthropic-messages`, not Copilot or Vercel mirrors. See [Preserved thinking and model switches](/models/reference#preserved-thinking-and-model-switches).
</Note>

<Note>
**Gemini 3.8 Flash is in Atomic's catalog and is measured in the DeepSWE table above.** A separate read of [Datacurve's rendered leaderboard](https://deepswe.datacurve.ai/) on **2026-09-05** confirmed its September 3, 2026 snapshot and the `gemini-3.8-flash [high]` row at **74% pass@1, $2.36/task, 143k output tokens and 166 steps**. These are its own measurements, not Gemini 3.7 Flash's. Its AA measurements above are a separate experiment, and neither benchmark proves access through your configured provider.

For `gemini-3.8-flash`, [Google's model page](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-8-flash) and [developer's guide](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/guides/gemini-3-8-flash), updated September 3 and retrieved 2026-09-05, report 1,048,576 context tokens, 65,536 maximum output tokens, multimodal input, and text output. Atomic accepts `text` and `image` on this route. Google, Google Vertex, and opencode zen offer `low`, `medium`, and `high`; thinking cannot be disabled and `MINIMAL` is unsupported.

The [September 2 model card](https://deepmind.google/models/model-cards/gemini-3-8-flash/), retrieved 2026-09-05, gives a March 2026 knowledge cutoff, with some domains limited to January 2025. AA lists $0.75 input and $3.75 output per million tokens; Google's cache-read rate is $0.075. These are token prices, not measured task costs.

Run `workflow({ action: "models" })` or `--list-models` to check provider-specific Gemini 3.8 Flash limits. At this snapshot, Copilot offers 1,000,000 context tokens, 64,000 output tokens, and `low`, `medium`, and `high`, subject to rollout and administrator policy. Vercel AI Gateway offers 1,000,000 context tokens and lists `off` and `minimal` alongside those three levels. Do not assume Google's limits apply to every route.
</Note>

## Role-based thinking effort

Use this table when the user has not requested a thinking level. It is a production default by stage role, not a claim about the level used by any benchmark row:

| Stage role | Default thinking level | Why |
| --- | --- | --- |
| Coding, implementation, routine fixes | `low` or `medium` | Keep implementation fast; use review and tests to catch defects. |
| Code review, test design, failure analysis, security, identity, adversarial challenge, final approval | `high` or `xhigh` | Spend more reasoning on finding defects, probing edge cases and judging evidence. |
| Codebase mapping, lifecycle analysis, compatibility, planning, synthesis, triage | `high` | These stages must resolve demanding uncertainty and preserve evidence across handoffs; routine synthesis may use `medium` when evidence quality holds. |
| User-impact review and final reporting | `medium` | Clear evidence-backed summaries usually do not need the deepest reasoning. |
| Deterministic checks | No model call | Run typechecks, tests, schema checks, runtime probes, and artifact checks as durable tool nodes. |

`max` is an exception, not a role default. Consider it only when task-specific evidence justifies the extra effort or the user explicitly requests it. An explicit request wins over these defaults, but the requested level still must appear in the configured catalog; do not invent an unsupported suffix. For each primary and fallback, choose a supported level for the same stage role independently. If `xhigh` is unavailable, use `high` rather than automatically promoting to `max`; choose another catalog model or leave the stage unpinned if neither is supported.

## Scenario-based guidance

Pick by the cost of being wrong in each role, not by raw accuracy. The AA evidence below was read on 2026-09-08; the Datacurve evidence remains the September 3 snapshot. See [Evals](/models/evals) for measurement settings, normalized Elo versus pass-rate units and source links.

- **Reviewer / judgment gates.** Use `high` or `xhigh` for code review and approval decisions, subject to the configured model's supported efforts. No external benchmark here establishes security-review reliability. Claude Code + Fable 5.1 max with fallback and Claude Code + Opus 5 xhigh score 56% and 55% on SWE-Atlas-QnA, versus 51% for Codex + Astra max, but those harness-specific results need validation in Atomic.
- **Codebase mapping / planner.** Start at `high`. For knowledge-work deliverables, Fable 5.1 max with fallback scores 58% normalized Elo on AA-Briefcase, Opus 5 max 57%, and GLM-5.3-Flash 48% at $0.25 per Index task. These are candidates, not measured repository-planning pass rates. Raise effort only for the role's cost of error or the user's request.
- **Debugger / triage / repair.** Use `high` or `xhigh` for failure analysis and test design, then `low` or `medium` to implement a diagnosed fix. The new Terminal-Bench v4.0 is no longer flat near 90%: Astra xhigh scores 60%, Fable 5.1 xhigh with fallback 55%, Opus 5 max 49%, and Gemini 3.8 Flash high 20%. Keep Datacurve cost and steps as separate evidence; do not transfer its 74% Gemini result into this benchmark.
- **Research / synthesis.** Use `high` for demanding reconciliation and `medium` for routine synthesis. Luna max scores 84% on AA-LCR at $0.18 per Index task, but its 7% non-hallucination rate counts partial answers or not attempted among non-correct responses, not all answers. Verify factual claims. Astra xhigh leads the displayed GDP.pdf rows at 32%; GLM-5.3-Flash and GLM-5.3 max score 72% and 70% non-hallucination.
- **Orchestrator / worker / cheap loops.** Use AutomationBench-AA for SaaS tool workflows: Astra max 68%, GLM-5.3-Flash 60%, Luna max 50%. GLM-5.3-Flash and Luna remain budget candidates on the separately dated Datacurve frontier. Gemini 3.8 Flash's 166 steps and 143k output tokens in that snapshot argue against choosing workers on pass rate alone. Validate the tradeoff on the actual workflow.
- **User-impact review / final reporting.** Use `medium` for impact summaries and reports that preserve the evidence needed by the user. If the stage makes an approval decision, use the reviewer guidance instead.
- **Design** — a quality-first domain not directly measured by these coding tables. Choose effort by the review or approval role. Fable 5.1's AA-Briefcase results make it a candidate for knowledge-work deliverables, not proof of product-design quality; evaluate it on the intended design tasks and do not carry Fable 5's DeepSWE row over to it.
- **Interactive coding sessions.** Use `low` or `medium` for implementation, switching to `high` or `xhigh` for code review, test design and failure analysis. Choose only levels supported by the configured model.
- **Deterministic checks** — make typechecks, tests, schema validation, runtime probes, and artifact inspection tool nodes with no model call. Model self-report is not verification evidence.

## Related

- [Pareto Efficiency](/models/pareto-efficiency) — cost-vs-accuracy frontier, dominated models, and provider-diversity exceptions.
- [Evals](/models/evals) — what Artificial Analysis and DeepSWE measure, per benchmark, and how to keep these docs fresh from the live source.
- [Custom models](/models) — how to add model entries for supported provider APIs.
