---
title: "Pareto Efficiency"
description: "Cost-vs-accuracy frontier for model selection: which models dominate, which are dominated, and when diversity overrides efficiency."
---

# Pareto Efficiency

A model is **Pareto-efficient** (on the frontier) if no other model is both cheaper and more accurate. Everything not on the frontier is **dominated**: some other option matches or beats it on accuracy for less money. Avoid a dominated model unless it earns a slot through a specific role fit or provider diversity.

The axes here are `pass@1` (accuracy) and `average dollars per task` (cost), taken from the [DeepSWE](https://deepswe.datacurve.ai/) coding-agent leaderboard. For compact dated DeepSWE facts, see [Evals](/models/evals); for general effort and catalog guidance, see [Model Selection](/models/model-selection).

<Note>
Figures are a snapshot of DeepSWE v1.1 using the highest published thinking level for each of the 21 models displayed on the September 3, 2026 leaderboard. They include the August 21 pricing corrections for GPT-5.6 Sol and DeepSeek V4, and GPT-6 Astra's costs are DeepSWE's expected launch pricing rather than billed rates. DeepSWE's own default table view is **Best** — the best-scoring configuration per model — which picks a different row for four models; the frontier under that reading is stated below. DeepSWE publishes a live cost-vs-score scatter, so **read the frontier off the live chart** rather than trusting a static list. **Last compiled: 2026-09-03.**
</Note>

The [AA measurements](/models/evals) are separately dated **2026-09-08**. Intelligence Index v4.3, announced September 7, uses weighted intelligence and its own cost per task; Coding Agent Index v1.4 uses named-agent runs including Terminal-Bench v2.1 rather than v4.0. Neither defines or updates this September 3 Datacurve frontier.

## The frontier

Three displayed highest-effort model configurations sit on the frontier, from the cheapest measured task cost to the accuracy ceiling:

- **glm-5.3-flash [max]**: 63% for $0.24 with 123 average steps. This is the cheapest point.
- **gpt-5.6-luna [max]**: 67% for $0.61 with 102 average steps. This is the cheapest broadly-capable point.
- **gemini-3.8-flash [high]**: 74% for $2.36 with 166 average steps and 143k output tokens. This is the current accuracy ceiling, and also the step-heaviest point on the frontier — weigh that before making it a worker default.

DeepSWE's default **Best** view selects each model's best-scoring configuration rather than its highest effort. The same three frontier points remain, and `gpt-6-astra [xhigh]` joins as the accuracy ceiling: 74.12% unrounded for \$6.52 with 29 average steps.

That frontier position applies only to the Best view. At its highest published effort, `max`, GPT-6 Astra scores 73.23% for \$12.37 and is dominated by both Gemini 3.8 Flash and Claude Opus 5.

The Best view also shows `claude-fable-5 [xhigh]` at 70% for \$13.41, `grok-4.6 [medium]` at 67% for \$3.45, and `gemini-3.7-flash [medium]` at 65% for \$2.03. None reaches the frontier.

## What changed

In this September 3 snapshot, Gemini 3.8 Flash replaces Opus 5, Sol, and GLM-5.3 on the highest-effort frontier; GLM-5.3 Flash and Luna retain the budget end. Astra joins only in the Best view at `xhigh`, not at `max`.

The chart uses published peak-rate DeepSeek costs. Off-peak rates are half as much: V4 Pro remains dominated, while V4 Flash at about $0.23 becomes slightly cheaper than GLM-5.3 Flash's $0.24 but remains ten rounded points less accurate. Recheck current prices before choosing.

## Dominated models and why

- **claude-opus-5 [max]**: Gemini 3.8 Flash is more accurate unrounded (73.83% versus 73.65%; both display 74%) and costs $9.48 less per task. Opus 5 keeps a role only as the Anthropic entry in the accuracy-ceiling class.
- **gpt-6-astra [max]**: dominated twice over — Claude Opus 5 scores higher for $0.53 less, and Gemini 3.8 Flash scores higher for $10.01 less. Its costs are expected launch pricing, not billed rates.
- **gpt-5.6-sol [max]**: Gemini 3.8 Flash is more accurate and costs just over a third as much. Sol remains the OpenAI-family near-peer at about half of Opus 5's task cost.
- **glm-5.3 [max]**: Gemini 3.8 Flash is five rounded points more accurate and costs $1.63 less. GLM-5.3 stays the best open-weights point on the board.
- **deepseek-v4-pro [max]**: GLM-5.3 Flash has a higher unrounded score, costs $1.43 less, and averages 123 steps instead of 155.
- **deepseek-v4-flash [max]**: GLM-5.3 Flash is ten rounded points more accurate and costs $0.22 less.
- **claude-fable-5 [max]**: Sol is more accurate and much cheaper; GLM-5.3 comes within a point for less than one fifth of the task cost. This row is Fable 5 only; `claude-fable-5-1` is still unmeasured in the September 3, 2026 snapshot and has no measured position on the frontier.
- **kimi-k3 [max]**: GLM-5.3 matches its rounded score and is $0.66 cheaper; Kimi remains useful for Moonshot-family diversity.
- **gpt-5.5 [xhigh]** and **grok-4.6 [xhigh]**: Luna matches their rounded 67% for $0.61.
- **gemini-3.7-flash [high]**: Luna is two points more accurate and costs less than one third as much. This row is Gemini 3.7 Flash only. Gemini 3.8 Flash has its own measured `[high]` row and frontier position above; it does not inherit its predecessor's result.
- **muse-spark-1.2 [xhigh]**: GLM-5.3 Flash is eight points more accurate and costs $3.46 less.
- **claude-opus-4.8 [max]** and **claude-sonnet-5 [max]**: each is dominated on both cost and accuracy.
- **qwen3.8-max [xhigh]**, **gemini-3.6-flash [high]**, **gemini-3.5-flash [high]**, and **glm-5.2 [max]**: each has a cheaper, more accurate displayed alternative.

Seven measured configurations are excluded from DeepSWE's default model selection and therefore from this frontier calculation. They are still in the current v1.1 artifact and can be re-enabled in the site's model picker, so this is a display default rather than a withdrawal. Re-check the live DeepSWE table before relying on their values: GPT-5.6 Terra, Grok 4.5, Muse Spark 1.1, GPT-5.4, Kimi K2.7 Code, Claude Sonnet 4.6, and Gemini 3.1 Pro Preview.

## Diversity and role-fit exceptions

Efficiency is not the only axis. A dominated model can still earn a slot when it decorrelates errors or fills a niche:

- **deepseek-v4-pro** and **deepseek-v4-flash** remain DeepSeek provider-diversity options, not budget-frontier choices.
- **grok-4.6** remains the operational xAI and OpenRouter provider-diversity fallback.
- **glm-5.2 [max]** remains only as a measured predecessor; its results are never relabeled as GLM-5.3 or GLM-5.3 Flash.
- **kimi-k3** remains a Moonshot-family provider-diversity option despite GLM-5.3's strict DeepSWE dominance.
- **claude-opus-4.8 [max]** remains useful where Anthropic diversity or its long-context behavior has separate value.
- **claude-opus-5 [max]** is dominated now but remains the Anthropic model in the accuracy-ceiling class, which matters when a judgment gate needs decorrelated errors from a different family than the frontier ceiling.
- **gpt-5.6-sol [max]** is the OpenAI-family near-peer to the ceiling and stays the top-tier choice when Google-family routing is unavailable or unwanted.
- **glm-5.3 [max]** remains the best open-weights point; the new frontier ceiling is closed-weights, so the open-weights niche survives the frontier change intact.
- **gemini-3.8-flash [high]** holds the frontier ceiling but is Google-family and step-heavy at 166 average steps; pair it with a model from another family for fallback diversity rather than routing every stage through one provider.
- **claude-fable-5** remains useful where Anthropic-family behavior is specifically wanted, such as the quality-first, unbenchmarked design chain.
- **claude-fable-5-1** is available in Atomic's catalog but absent from the September 3, 2026 Datacurve snapshot, so it has no position on this frontier. The dated AA records in [Evals](/models/evals) include Fable 5.1 default-fallback measurements where available. Those results justify task-specific evaluation, not importing AA scores or costs into this DeepSWE chart. A token-price discount is not a measured task-cost saving.
- **Unmeasured models** may remain operational defaults when a family lacks current DeepSWE or Artificial Analysis coverage, but they should not inherit a predecessor's score.

## How to use this

1. Choose from the frontier for the role's accuracy needs, then apply the general effort and catalog checks in [Model Selection](/models/model-selection).
2. Only reach for a dominated model when you have an explicit reason, such as provider diversity, a long-context or token-price niche, or an unbenchmarked domain like design.
3. Re-read the frontier on the [DeepSWE live chart](https://deepswe.datacurve.ai/) when prices or benchmarks change.

## Related

- [Model Selection](/models/model-selection)
- [Evals](/models/evals)
