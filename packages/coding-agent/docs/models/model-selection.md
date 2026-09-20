---
title: "Model Selection"
description: "Concise model-selection guidance with measured results, cost tradeoffs and thinking effort."
---

# Model Selection

Choose for the actual task, not a model's name or aggregate rank. Prefer a cost-effective capable option. A literal response or mechanical task rarely needs deep reasoning.

## Automatic subagent routing

Subagent and workflow-stage `model: "auto"` receive this guide verbatim with the task and eligible model/effort choices. No separate benchmark dataset or provider-name filter is used. The installed guide is a dated reference, not a live query. [`routerModel`](/settings#routermodel) chooses the decision provider, not the execution model. Long tasks may be excerpted for selection; execution receives the full prompt.

## Benchmark levels are measurement settings

A bracketed level is the measurement configuration used for that benchmark result, not a universal workflow default. Do not claim the same score for another version, effort, agent or fallback configuration. Missing evidence is unknown, not zero. Rounded differences do not establish significance. Benchmarks inform model suitability, not identical behavior, latency or reliability across serving providers. Use the supplied catalog for current provider prices and capabilities.

## Recommendation chart

[Datacurve DeepSWE](https://deepswe.datacurve.ai/) v1.1, **2026-09-03** snapshot, read **2026-09-05**: 113 tasks, 91 repositories, five languages, mini-swe-agent. This is the **Best** view: the best-scoring measured effort per model. Costs are USD per benchmark task, not token prices or predicted Atomic bills. All 21 default rows follow.

| Model [measured effort] | pass@1 | $/task | Output tokens | Steps |
| --- | --- | --- | --- | --- |
| gpt-6-astra [xhigh] | 74% ±3 | 6.52 | 30k | 29 |
| gemini-3.8-flash [high] | 74% ±1 | 2.36 | 143k | 166 |
| claude-opus-5 [max] | 74% ±4 | 11.84 | 118k | 99 |
| gpt-5.6-sol [max] | 73% ±3 | 6.46 | 60k | 61 |
| claude-fable-5 [xhigh] | 70% ±3 | 13.41 | 80k | 68 |
| glm-5.3 [max] | 69% ±3 | 3.99 | 80k | 124 |
| kimi-k3 [max] | 69% ±5 | 4.65 | 81k | 98 |
| grok-4.6 [medium] | 67% ±2 | 3.45 | 50k | 70 |
| gpt-5.6-luna [max] | 67% ±4 | 0.61 | 73k | 102 |
| gpt-5.5 [xhigh] | 67% ±6 | 7.23 | 46k | 82 |
| gemini-3.7-flash [medium] | 65% ±3 | 2.03 | 94k | 117 |
| glm-5.3-flash [max] | 63% ±4 | 0.24 | 73k | 123 |
| deepseek-v4-pro [max] | 63% ±6 | 1.67 | 106k | 155 |
| claude-opus-4.8 [max] | 59% ±2 | 13.22 | 135k | 120 |
| qwen3.8-max [xhigh] | 57% ±3 | 3.73 | 95k | 111 |
| muse-spark-1.2 [xhigh] | 55% ±2 | 3.70 | 99k | 101 |
| claude-sonnet-5 [max] | 54% ±4 | 26.40 | 214k | 268 |
| deepseek-v4-flash [max] | 53% ±4 | 0.46 | 108k | 153 |
| gemini-3.6-flash [high] | 47% ±4 | 2.21 | 96k | 117 |
| glm-5.2 [max] | 44% ±2 | 3.92 | 78k | 129 |
| gemini-3.5-flash [high] | 36% ±4 | 3.45 | 76k | 105 |

The 74% rows overlap within their intervals. Astra uses fewer steps; Gemini costs less but uses more steps and output tokens. Luna and GLM-5.3-Flash are budget candidates with lower accuracy. Sonnet 5 has the highest task cost and step count for 54%; do not default to it when better-fitting eligible choices exist.

Astra costs use expected launch prices, not billed rates. Sol uses promotional pricing; DeepSeek uses peak rates. Fable 5.1 is absent from this snapshot: Fable 5's result is not its result. See [Evals](/models/evals) for methodology and [Pareto Efficiency](/models/pareto-efficiency) for cost/accuracy tradeoffs.

## AA cross-check for current candidates

[Artificial Analysis](https://artificialanalysis.ai/leaderboards/models), retrieved **2026-09-08**, Intelligence Index **v4.3**, announced September 7. These are separate experiments from Datacurve; no per-measurement publication date is supplied. Fable 5.1 results below include default fallback, not an arbitrary no-fallback setup.

| Task / evaluation | Selected measured results |
| --- | --- |
| Terminal / Terminal-Bench v4.0 | Astra xhigh 60%, max 59%; Fable 5.1 xhigh with fallback 55%; Opus 5 max 49%; Gemini 3.8 Flash high 20%; Sonnet 5 max 14% |
| Knowledge deliverables / AA-Briefcase, GDPval-AA v2 | Fable 5.1 max with fallback 58% / 63%; Opus 5 max 57% / 62%; GLM-5.3-Flash 48% / 58%. Normalized Elo, not pass rates. |
| SaaS REST tools / AutomationBench-AA | Astra max 68%; Astra high/xhigh and Grok 4.6 high 67%; GLM-5.3-Flash 60%; Luna max 50% |
| Documents / GDP.pdf All-pass | Astra xhigh 32%, max/high 31%, low 30%; Luna max 24%. Every criterion must pass. |
| Long context / AA-LCR v1.1 | Kimi K3 max 89%; Fable 5.1 max with fallback 85%; Luna max 84% |
| Knowledge / AA-Omniscience non-hallucination | GLM-5.3-Flash 72%; GLM-5.3 max 70%; Muse Spark 1.3 xhigh 69%; Luna max 7%. Partial or unattempted responses among non-correct answers, not overall accuracy. |
| Scientific programming / SciCode | Fable 5.1 max with fallback 63%; Fable 5 with fallback 61%; Gemini 3.8/3.7 Flash high 57% |

GLM-5.3-Flash costs $0.25 and Luna max $0.18 per AA Index task. These are not Datacurve or Atomic task costs. The separate Coding Agent Index v1.4 measures named agent/model combinations: Claude Code + Fable 5.1 max with fallback scores 70 at $9.18/task; Opencode + Gemini 3.8 Flash high 61 at $2.04; Codex + Luna max 57 at $0.29. These are not base-model scores. Full tables, latency measurements and methodology are in [Evals](/models/evals).

## Role-based thinking effort

Use these starting defaults unless the user requests a level. `max` is usually overkill and is not preferred in practice.

| Stage role | Default thinking level | Why |
| --- | --- | --- |
| Coding, implementation, routine fixes | `low` or `medium` | Validate with tools and review. |
| Code review, test design, failure analysis, security, identity, adversarial challenge, final approval | `high` or `xhigh` | Spend reasoning on finding defects. |
| Codebase mapping, lifecycle analysis, compatibility, planning, synthesis, triage | `high` | Resolve uncertainty; routine synthesis may use medium. |
| User-impact review and final reporting | `medium` | Preserve evidence without unnecessary reasoning. |
| Deterministic checks | No model call | Run tests, typechecks and probes directly. |

`max` is an exception, not a role default. Consider it only when task-specific evidence justifies the extra effort or the user explicitly requests it. An explicit request wins over these defaults, but the requested level still must appear in the configured catalog; do not invent an unsupported suffix. For each primary and fallback, choose a supported level for the same stage role independently. If `xhigh` is unavailable, use `high` rather than automatically promoting to `max`; choose another catalog model or leave the stage unpinned if neither is supported.

## Scenario-based guidance

Coding: weigh DeepSWE accuracy, cost and steps. Debugging: cross-check Terminal-Bench. Planning: use knowledge-deliverable evidence. Research: use long-context, document and knowledge evaluations. Review and design: these benchmarks do not establish security-review reliability or design quality; validate on actual tasks. Model self-report is not verification.

## Pin model identity

Choose only eligible provider/model and effort pairs from the supplied catalog; guide recommendations cannot bypass hard constraints. For manual selection, use `workflow({ action: "models" })` or `--list-models` and pin a returned `fullId`. Catalog presence is not proof of working credentials or entitlement.

## Answering model-choice questions

For interactive advice, read [Evals](/models/evals), then consult [Artificial Analysis](https://artificialanalysis.ai/) and the relevant live methodology. Cite source date, exact model/effort and cost or latency tradeoffs. If live evidence is unavailable, label this dated snapshot rather than claiming a refresh.
