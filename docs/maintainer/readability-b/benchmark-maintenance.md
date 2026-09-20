# Maintaining benchmark snapshots

Relocated from `packages/coding-agent/docs/models/artificial-analysis-index.md` and `models/evals.md` under “Keeping the docs fresh”, from `models/model-selection.md` provider-generation/history notes, and from `models/pareto-efficiency.md` under “What changed”. Public model guidance retains dated measurements, charts, source links, uncertainty, and task-specific recommendations. This relocation does not refresh any benchmark.

## Refresh procedure

flora131's original guidance was to point models at live benchmark URLs and explain what each measures, rather than continually hardcoding stale scores. Treat selection pages as timestamped source snapshots. Pull new models from DeepSWE and Artificial Analysis, and consider generating documentation and routing inputs from shared data to avoid drift.

Record retrieval separately from publication/snapshot dates. Preserve exact model, effort, agent, benchmark version, units, and displayed precision. Prefer rendered charts and methodology to old announcement scores. Say “unmeasured on the named benchmark and date”; do not treat failed text extraction as absence or transfer a predecessor's score. The older sources page said to mark unmeasured only when absent from both sources; the later per-benchmark qualification is more precise. Unmeasured models may still be operational defaults. Check configured catalog and actual access separately; changing benchmark docs does not change runtime defaults.

AA per-evaluation values live in client-rendered Recharts. Plain HTTP extraction can return only headings. Open model pages in a browser, scroll the entire page to trigger chart animation, and pair `foreignObject` model labels with `svg text` values in bar order. DeepSWE and AA evaluation leaderboards such as AA-Briefcase and GDPval-AA v2 render readable text.

## Retrieval history and naming

The September 5, 2026 browser check confirmed DeepSWE's September 3 date and Gemini 3.8 Flash row, not every configuration. The September 8 AA v4.3 refresh did not recompute or revalidate that DeepSWE snapshot. Keep that distinction rather than presenting all tables as newly verified.

Earlier docs referred to base-model Coding Index and Agentic Index. Neither appeared in the [capability directory](https://artificialanalysis.ai/models/capabilities) or [methodology](https://artificialanalysis.ai/methodology/capability-indices) inspected September 8. Do not rename them to Coding Agent Index: that is a different named-agent experiment.

## Frontier history

The September 3 highest-published-effort frontier dropped from five to three members after Gemini 3.8 Flash's September 1 arrival: 73.83% unrounded, displayed 74%, at $2.36. Opus 5 remained 73.65%, also 74%, at $11.84. Gemini's $9.48 saving and higher accuracy displaced Opus 5, GPT-5.6 Sol, and GLM-5.3 without changing their measurements.

Astra arrived September 3 at low/medium/high/xhigh/max. Its highest-effort max result, 73% at $12.37, was dominated by Gemini and Opus. Its costs were expected launch prices rather than billed rates. The Best-view frontier differs; retain the public guide's xhigh qualification.

GLM-5.3 Flash max, 63% at $0.24 and 123 steps, and Luna max, 67% at $0.61, retained the budget frontier. August corrections had already displaced both DeepSeek V4 variants. V4 Pro became $1.67 after August 16; GLM Flash was 63.4% versus 62.8%, roughly one seventh the cost and 32 fewer steps. V4 Flash became $0.46, ten rounded points below GLM Flash at roughly twice the cost. Sol's August 20 promotion reduced $8.39 to $6.46 through at least November 21.

DeepSWE's August 21 changelog uses peak DeepSeek rates; off-peak halves them. Pro remains dominated. Flash at roughly $0.23 is slightly cheaper than GLM Flash's $0.24 but ten points less accurate. The published frontier uses peak-rate task costs, not an off-peak recomputation.

## Provider-generation observations

The prior Fable 5.1 note listed Anthropic, Copilot, three Bedrock profiles (`anthropic.`, `global.`, `us.`), OpenRouter, and Vercel. Copilot's static Fable 5/5.1 metadata came from models.dev while authenticated availability remained account-controlled. opencode zen published and withdrew Fable 5.1 during documentation preparation. Other public catalogs listed Vertex, Vertex Anthropic, Azure, and Azure Cognitive Services; Atomic had no Claude integration for those routes. This is historical inventory, not a future commitment or proof of account access. First-party preserved-thinking behavior must not be copied to mirrors merely because they use `anthropic-messages`.

The Gemini 3.8 Flash Copilot row came from models.dev unchanged, with 1,000,000 context, 64,000 output, low/medium/high, through Copilot's OpenAI-compatible endpoint. Vercel advertised 1,000,000 context with no per-model efforts, so its entry exposed off/minimal plus Google's three levels. Provider metadata differs; public guides retain those selection limits. Google's removal of MINIMAL from 3.7 Flash onward conflicted with Atomic's older 3.7 catalog entry; that existing gap was not fixed here.
