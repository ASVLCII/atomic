---
title: "Evals"
description: "Primary-source benchmark facts used by Atomic automatic model routing."
---

# Evals

Facts only; accessed 2026-09-20. `∅`=source null/absent, not zero.

## Artificial Analysis Intelligence Index v4.3.2

The [Intelligence Index](https://artificialanalysis.ai/evaluations/artificial-analysis-intelligence-index) (v4.3.2, [methodology](https://artificialanalysis.ai/methodology/intelligence-benchmarking)) is Artificial Analysis's weighted composite of public intelligence, coding, and agentic evaluations. This table is the 47-config default-chart union: 31 aggregate Index rows plus default constituent selections (311 displayed constituent records; CritPt has 32). Constituents are [AA-Briefcase v1.1](https://artificialanalysis.ai/evaluations/aa-briefcase), [GDPval-AA v2.1](https://artificialanalysis.ai/evaluations/gdpval-aa), AutomationBench-AA, Terminal-Bench 4.0, SciCode, [Humanity's Last Exam](https://artificialanalysis.ai/evaluations/humanitys-last-exam), GDP.pdf All-pass, CritPt, Omniscience, and [AA-LCR v1.1](https://artificialanalysis.ai/evaluations/artificial-analysis-long-context-reasoning). GPQA and MMMU-Pro are not constituents. Columns: `idx`=Index points; `Bn`/`Gn`=normalized Elo `clamp((Elo−500)/2000)*100`; `Auto`/`TB`/`Sci`/`HLE`/`PDF`/`Crit`/`OA`/`ONH`/`LCR`=percent, where `OA` is Omniscience accuracy and `ONH` is the 6,000-question ONH rate `(partial+notattempted)/(incorrect+partial+notattempted)`. Row labels use source `chart_label`, or `full_config_label` when the chart omits settings. Fable rows use Adaptive Reasoning; Fable 5 fallback=Opus 4.8, Fable 5.1 Default Fallback. Inkling AA `xhigh` is distinct from Frontier `0.99`.

| ID | Model | idx | Bn | Gn | Auto | TB | Sci | HLE | PDF | Crit | OA | ONH | LCR |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| A01 | Claude Fable 5.1 (max with fallback) | 53 | 58.9 | 61.7 | 59.4 | 52 | 63.1 | 59.1 | 26.2 | 29.7 | 67.2 | 27.4 | 85.3 |
| A02 | Claude Fable 5.1 (xhigh with fallback) | 53 | 58.4 | 61 | 57.8 | 55.1 | 60.9 | 58.7 | 26.2 | 31.1 | 66.2 | 29.5 | 83 |
| A03 | GPT-6 Astra (max) | 53 | 53.4 | 52.1 | 68.5 | 59.1 | 56.5 | 54.7 | 31 | 31.7 | 62.6 | 48.7 | 80.7 |
| A04 | GPT-6 Astra (xhigh) | 52 | 52.2 | 50.8 | 67.2 | 59.6 | 55.7 | 54.6 | 32.2 | 31.4 | 61.9 | 51.7 | 80 |
| A05 | Claude Fable 5.1 (high with fallback) | 51 | 54.6 | 55.9 | 55.3 | 52 | 58.7 | 55.9 | 26.8 | 30.3 | 64.9 | 31.2 | 83.7 |
| A06 | GPT-6 Astra (high) | 51 | 50.3 | 49.2 | 66.6 | 54 | 55.4 | 53.1 | 31 | 28.9 | 61.1 | 55.2 | 80 |
| A07 | Claude Opus 5 (max) | 51 | 58.7 | 60.4 | 56.6 | 49 | 56.4 | 54.9 | 21.6 | 29.1 | 60.9 | 39.2 | 79.3 |
| A08 | Claude Opus 5 (xhigh) | 50 | 57.5 | 58.8 | 53.2 | 46.5 | 55.7 | 54.4 | 21 | 27.7 | 59.5 | 40.5 | 80.3 |
| A09 | Claude Fable 5 (Adaptive Reasoning, Max Effort, Opus 4.8 Fallback) | 50 | 52.2 | 54.8 | 54.1 | 42.4 | 61 | 55.5 | 24 | 28.6 | 65.3 | 36.4 | 82.3 |
| A10 | GPT-6 Astra (medium) | 50 | 48 | 48.4 | 64.6 | 49.5 | 54.2 | 52.7 | 30.4 | 29.1 | 60.6 | 53.5 | 79.7 |
| A11 | Claude Fable 5.1 (medium with fallback) | 49 | 52.1 | 51.8 | 54.7 | 44.9 | 56.4 | 53.8 | 26.8 | 29.1 | 63.1 | 30.9 | 84.7 |
| A12 | Claude Opus 5 (high) | 48 | 53.7 | 54 | 53.6 | 46 | 55.4 | 52.8 | 19.6 | 28.3 | 58.9 | 38.8 | 79 |
| A13 | Muse Spark 1.3 (max) | 48 | 54.9 | 58.7 | 57.9 | 33.3 | 58.8 | 48.7 | 26.6 | 24.9 | 43.6 | 67.1 | 83 |
| A14 | GPT-5.6 Sol (max) | 47 | 49.4 | 54.4 | 60.1 | 39.9 | 57.1 | 49.5 | 27.2 | 32.3 | 59.4 | 7.8 | 84 |
| A15 | Claude Fable 5.1 (low with fallback) | 47 | 49.5 | 47.5 | 52.2 | 40.4 | 56.7 | 48.9 | 28 | 27.7 | 60.2 | 34.4 | 82.3 |
| A16 | GPT-6 Astra (low) | 46 | 38 | 43.3 | 59.1 | 41.9 | 54.1 | 49.2 | 30.4 | 26.3 | 59.5 | 53.1 | 80 |
| A17 | Qwen3.8 Max (0902) | 45 | 57.1 | 58.4 | 56.2 | 38.9 | 52.1 | 43.1 | 22.8 | 17.7 | 31.7 | 71.2 | 80.3 |
| A18 | Muse Spark 1.3 (xhigh) | 45 | 49.7 | 56.4 | 56.8 | 16.7 | 59.7 | 47.5 | 24.2 | 26 | 41.5 | 68.5 | 83 |
| A19 | GLM-5.3 (max) | 45 | 51.3 | 57.3 | 62.2 | 41.9 | 59 | 42.3 | 11.2 | 19.1 | 33.9 | 70.4 | 79.7 |
| A20 | Grok 4.6 (high) | 44 | 51.2 | 55.3 | 66.7 | 21.2 | 56.5 | 42.9 | 17 | 17.1 | 48.2 | 65.7 | 80.3 |
| A21 | Grok 4.6 (xhigh) | 44 | 52.8 | 56.6 | 67 | 17.2 | 53 | 44.1 | 17.2 | 19.7 | 43 | 76 | 81 |
| A22 | Step 5 Preview | 44 | 46.7 | 53.3 | 51 | 33.3 | 58.9 | 46.5 | 14.8 | 20.9 | 41.5 | 57 | 88.3 |
| A23 | Kimi K3 (max) | 44 | 50.6 | 51.2 | 58.3 | 12.6 | 59.5 | 46.9 | 22 | 23.4 | 47.6 | 46.8 | 88.7 |
| A24 | Grok 4.6 (medium) | 43 | 49.6 | 55.2 | 63.2 | 13.1 | 55.9 | 42.1 | 17.8 | 17.7 | 41.9 | 76 | 81 |
| A25 | GPT-5.6 Terra (max) | 42 | 41.9 | 46.6 | 59.6 | 35.4 | 55 | 42.9 | 24 | 30 | 46.8 | 12.1 | 83 |
| A26 | GLM-5.3-Flash | 42 | 48 | 57 | 60.4 | 32.8 | 51.6 | 39.9 | 15.4 | 15.4 | 27.5 | 72.4 | 80 |
| A27 | Gemini 3.8 Flash (high) | 41 | 35.1 | 45.6 | 59.9 | 19.7 | 56.6 | 47.8 | 21 | 18.3 | 54.6 | 44.8 | 81.3 |
| A28 | Qwen3.8-Flash-Next | 40 | 54.9 | 55.6 | 55.9 | 25.3 | 50.6 | 38 | 15.6 | 11.1 | 24.5 | 54.7 | 79.7 |
| A29 | Gemini 3.8 Flash (medium) | 40 | 33.9 | 45.4 | 60.9 | 19.7 | 55.1 | 42.1 | 22.8 | 12.3 | 53 | 48.1 | 84 |
| A30 | Gemini 3.7 Flash (medium) | 40 | ∅ | 42 | ∅ | ∅ | 59.8 | 39 | ∅ | 9.4 | 54 | 34.1 | 83 |
| A31 | DeepSeek V4.1 Flash (Reasoning, Max Effort) | 39 | 46.7 | 55 | 68.9 | 26.8 | 51.9 | 39.2 | 12.8 | 14.3 | 46.4 | 3.5 | 84 |
| A32 | GPT-5.5 (xhigh) | 38 | 32 | 41.8 | 47.3 | 14.6 | 55.8 | 45.8 | 21.2 | 27.1 | 58 | 11 | 84.3 |
| A33 | GPT-5.6 Luna (max) | 37 | 42.3 | 47.1 | 50.2 | 11.6 | 53.6 | 39.5 | 24 | 20.6 | 42.7 | 7.4 | 83.7 |
| A34 | GPT-5.5 (high) | 37 | 29.5 | 40.5 | 44.3 | 9.1 | 56.1 | 45 | 22.6 | 25.4 | 57 | 10.9 | 84.3 |
| A35 | DeepSeek V4 Pro 0813 (Reasoning, Max Effort) | 36 | 38.1 | 47.1 | 56.7 | 14.1 | 51 | 41 | 11.4 | 18 | 49.1 | 5.2 | 80.3 |
| A36 | Muse Spark 1.1 (xhigh) | 34 | 17.3 | 35.4 | 38.8 | 6.1 | 58.8 | 46.2 | 14.4 | 15.1 | 52 | 50 | 77.7 |
| A37 | Qwen3.8 27B (xhigh) | 34 | 45.2 | 45.4 | 48.2 | 5.6 | 46.6 | 33.9 | 16.6 | 5.4 | 15.6 | 69.7 | 82 |
| A38 | K2 Horizon 375B A23B | 31 | 40.2 | 42.5 | 37.2 | 1.5 | 42.9 | 32 | 7.4 | 4.6 | 18.2 | 74.1 | 80 |
| A39 | MiniMax-M3 | 29 | 29.7 | 36.5 | 21.3 | 2 | 47.1 | 39 | 9.8 | 3.7 | 16.7 | 81.6 | 83 |
| A40 | Inkling (xhigh) | 25 | 16.5 | 28.2 | 5 | 1 | 47 | 31.9 | 12.8 | 5.4 | 41.5 | 32.3 | 77.3 |
| A41 | Nemotron 3 Ultra 550B A55B (Reasoning) | 23 | 18.7 | 25 | 3 | 0.5 | 40.3 | 28.4 | 5 | 3.1 | 22.6 | 70.3 | 79.3 |
| A42 | Gemini 3.5 Flash-Lite | 22 | 7.1 | 23.5 | 25 | 1 | 41.3 | 18.8 | 13.6 | 0 | 29.5 | 65.6 | 76 |
| A43 | Muse Glimmer (high) | 17 | 0 | 13.7 | 6.8 | 0.5 | 44.9 | 22 | 10 | 2.6 | 27 | 18.1 | 83.3 |
| A44 | Mistral Medium 3.5 | 14 | 0.7 | 12.4 | 6.3 | 0 | 40.2 | 13.8 | 2.8 | 0 | 24.7 | 18.4 | 69.3 |
| A45 | gpt-oss-120b (high) | 12 | 0 | 4.8 | 0.2 | 0 | 34 | 19.6 | 4 | 1.1 | 21.8 | 9.2 | 52 |
| A46 | GPT-5.4 Pro (xhigh) | ∅ | ∅ | ∅ | ∅ | ∅ | ∅ | ∅ | ∅ | 30 | ∅ | ∅ | ∅ |
| A47 | GPT-5.5 Pro (xhigh) | ∅ | ∅ | ∅ | ∅ | ∅ | ∅ | ∅ | ∅ | 30.6 | ∅ | ∅ | ∅ |

## DeepSWE v1.1

[DeepSWE](https://deepswe.datacurve.ai/) v1.1 (update 2026-09-03; [changelog](https://deepswe.datacurve.ai/changelog)) is a contamination-free software-engineering suite: 113 tasks across 91 repositories and 5 languages, all run on mini-swe-agent. The table is all 21 default Best rows in source order, each with `n_runs=4`. Columns: model, effort, pass@1±95% run-to-run CI (percent) with CI=`1.96*std(runs)/sqrt(R)`, USD/task, output k-tokens, and steps. Source costs are not billed Atomic cost: GPT-6 Astra uses expected launch pricing, DeepSeek peak rates (off-peak half), GPT-5.6 Sol promotional pricing.

| ID | Model | Effort | pass@1±CI | USD/task | output k-tokens | steps |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| D01 | gpt-6-astra | xhigh | 74±3 | 6.52 | 30 | 29 |
| D02 | gemini-3.8-flash | high | 74±1 | 2.36 | 143 | 166 |
| D03 | claude-opus-5 | max | 74±4 | 11.84 | 118 | 99 |
| D04 | gpt-5.6-sol | max | 73±3 | 6.46 | 60 | 61 |
| D05 | claude-fable-5 | xhigh | 70±3 | 13.41 | 80 | 68 |
| D06 | glm-5.3 | max | 69±3 | 3.99 | 80 | 124 |
| D07 | kimi-k3 | max | 69±5 | 4.65 | 81 | 98 |
| D08 | grok-4.6 | medium | 67±2 | 3.45 | 50 | 70 |
| D09 | gpt-5.6-luna | max | 67±4 | 0.61 | 73 | 102 |
| D10 | gpt-5.5 | xhigh | 67±6 | 7.23 | 46 | 82 |
| D11 | gemini-3.7-flash | medium | 65±3 | 2.03 | 94 | 117 |
| D12 | glm-5.3-flash | max | 63±4 | 0.24 | 73 | 123 |
| D13 | deepseek-v4-pro | max | 63±6 | 1.67 | 106 | 155 |
| D14 | claude-opus-4.8 | max | 59±2 | 13.22 | 135 | 120 |
| D15 | qwen3.8-max | xhigh | 57±3 | 3.73 | 95 | 111 |
| D16 | muse-spark-1.2 | xhigh | 55±2 | 3.70 | 99 | 101 |
| D17 | claude-sonnet-5 | max | 54±4 | 26.40 | 214 | 268 |
| D18 | deepseek-v4-flash | max | 53±4 | 0.46 | 108 | 153 |
| D19 | gemini-3.6-flash | high | 47±4 | 2.21 | 96 | 117 |
| D20 | glm-5.2 | max | 44±2 | 3.92 | 78 | 129 |
| D21 | gemini-3.5-flash | high | 36±4 | 3.45 | 76 | 105 |

## Cognition FrontierCode 1.1

[FrontierCode](https://cognition.com/frontiercode) 1.1 (revision 2026-07-07; [data](https://cognition.com/data/frontiercode-leaderboard/data.json); [methods](https://cognition.com/blog/frontier-code-1.1) and https://cognition.com/blog/frontier-code) scores end-to-end coding agents. Main is 100 tasks and Extended is 150. The table is Main Best rows in source order. Score is a weighted aggregate; blocking and unfair-use failures are zeroed. Columns: model, source effort label, harness, score, pass, flag (percent), USD/task, output k-tokens. Harness: `cc`=claude-code, `gb`=grok-build, `msa`=mini-swe-agent. `—`=source null, not 0; Inkling `0.99` is unexplained. Extended values remain linked (not routed).

| ID | Model | Effort | Harness | score | pass | flag | USD/task | output k-tokens |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| F01 | Claude Fable 5 | xhigh | cc | 53.5 | 58.9 | 0.3 | 13.09 | 58.6 |
| F02 | Claude Opus 5 | medium | cc | 53.4 | 58.9 | 0.6 | 4.31 | 33.6 |
| F03 | GPT-6 Astra | max | codex | 53.3 | 58.8 | — | 4.59 | 30.1 |
| F04 | Claude Fable 5.1 | medium | cc | 50.9 | 55.5 | 0.0 | 3.28 | 26.1 |
| F05 | SWE-2 | max | devin | 50.0 | 55.5 | — | 1.18 | 72.8 |
| F06 | Grok 4.6 | high | gb | 48.0 | 53.1 | 0.7 | 2.88 | 36.8 |
| F07 | GPT-5.6 Sol | max | codex | 47.5 | 52.9 | 0.0 | 5.19 | 33.2 |
| F08 | Claude Opus 4.8 | max | cc | 46.5 | 51.6 | 0.6 | 9.62 | 95.9 |
| F09 | Kimi K3 | none | msa | 44.2 | 48.9 | 0.2 | 3.82 | 53.6 |
| F10 | Gemini 3.7 Flash | medium | chisel | 43.6 | 48.9 | 0.0 | 1.82 | 51.1 |
| F11 | GPT-5.5 | xhigh | codex | 43.0 | 48.2 | 0.4 | 4.03 | 25.0 |
| F12 | Claude Sonnet 5 | xhigh | cc | 42.7 | 47.6 | 0.5 | 10.07 | 87.9 |
| F13 | Grok 4.5 | high | gb | 42.4 | 47.2 | 0.0 | 1.30 | 15.3 |
| F14 | SWE-1.7 | none | chisel | 42.0 | 47.4 | 1.2 | 1.97 | 64.8 |
| F15 | GPT-5.6 Terra | max | codex | 41.3 | 46.3 | 0.1 | 1.87 | 40.5 |
| F16 | Gemini 3.8 Flash | medium | chisel | 41.2 | 46.7 | 0.0 | 2.60 | 78.9 |
| F17 | GLM 5.3 | max | chisel | 40.1 | 44.7 | 0.0 | 16.91 | 112.2 |
| F18 | GPT-5.6 Luna | max | codex | 39.8 | 44.7 | 0.1 | 0.37 | 37.4 |
| F19 | Claude Opus 4.7 | max | cc | 38.5 | 42.8 | 0.1 | 9.09 | 49.1 |
| F20 | Gemini 3.6 Flash | medium | chisel | 34.4 | 38.9 | 0.0 | 4.04 | 46.7 |
| F21 | GLM 5.3 Flash | max | chisel | 31.8 | 35.7 | 0.0 | 1.15 | 169.3 |
| F22 | Kimi K2.7 | none | msa | 30.1 | 33.6 | 0.0 | 3.01 | 43.9 |
| F23 | DeepSeek V4 Pro 0813 | high | chisel | 28.5 | 31.8 | 10.6 | 1.81 | 104.7 |
| F24 | GPT-5.4-mini | xhigh | codex | 27.0 | 30.8 | 0.0 | 1.52 | 90.9 |
| F25 | Claude Opus 4.6 | high | cc | 26.6 | 29.7 | 0.1 | 3.98 | 26.7 |
| F26 | Composer 2.5 | none | cursor | 25.6 | 29.3 | 2.4 | 3.09 | 16.0 |
| F27 | GLM 5.2 | none | msa | 24.5 | 27.4 | 0.0 | 2.47 | 17.8 |
| F28 | Claude Sonnet 4.6 | max | cc | 24.3 | 27.5 | 0.2 | 2.90 | 44.2 |
| F29 | DeepSeek V4 Flash 0731 | high | chisel | 18.8 | 21.1 | 25.5 | 1.53 | 94.4 |
| F30 | DeepSeek V4 Pro | none | msa | 17.6 | 20.0 | 1.0 | 1.55 | 28.8 |
| F31 | MiniMax M3 | none | msa | 14.7 | 16.6 | 1.5 | 0.68 | 34.0 |
| F32 | Inkling | 0.99 | msa | 14.0 | 15.9 | 7.6 | 3.60 | 33.6 |
| F33 | Nemotron 3 Ultra | none | chisel | 13.6 | 15.4 | 0.2 | 1.47 | 27.7 |
| F34 | Qwen 3.7 Plus | none | msa | 10.2 | 11.5 | 0.9 | 0.24 | 45.3 |
| F35 | SWE-1.6 | none | chisel | 9.4 | 10.4 | 0.0 | 0.49 | 19.8 |
| F36 | Mistral 3.5 Medium | none | chisel | 8.0 | 9.0 | 0.6 | 1.35 | 22.5 |
