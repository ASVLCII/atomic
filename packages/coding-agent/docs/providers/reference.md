---
title: Provider reference
description: Provider stop reasons and credential resolution order.
---

# Provider reference

## Stop Reasons

Every provider reports why it ended a turn. Atomic stores one of `stop`, `length`, `toolUse`, `error`, or `aborted`; the provider's own string (`end_turn`, `MAX_TOKENS`, `tool_calls`, and so on) is mapped onto it.

An unrecognized terminal reason becomes a **provider error** that names the raw value, not an ordinary successful stop. This makes new truncation or safety reasons visible rather than making the model appear to stop early. Existing successful-stop mappings are unchanged. Provider safety or refusal errors retain the raw reason, for example `Provider stopped with: SAFETY`.

A streaming partial message carries `pending` until a terminal reason replaces it. A completed turn cannot remain `pending`: a stream that ends in that state is a provider error. See [Custom providers](/custom-provider) for the requirements when implementing a provider.

## Resolution Order

When resolving credentials for a provider:

1. CLI `--api-key` flag
2. `auth.json` entry (API key or OAuth token)
3. Environment variable
4. Custom provider keys from `models.json`
