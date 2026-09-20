# Development

For extensions and SDK integrations, start with [Build with Atomic](/build). Repository contribution instructions live in the [maintainer development guide](https://github.com/bastani-inc/atomic/blob/main/docs/maintainer/readability-a/development-and-startup.md).

## Setup

To install the released CLI, follow [Installation](/getting-started/installation). To run a source checkout, follow [maintainer setup](https://github.com/bastani-inc/atomic/blob/main/docs/maintainer/readability-a/development-and-startup.md#setup).

## Forking / Rebranding

Fork configuration is covered in [rebranding instructions](https://github.com/bastani-inc/atomic/blob/main/docs/maintainer/readability-a/development-and-startup.md#forking--rebranding).

## Path Resolution

Atomic supports package-manager installs and standalone archives. Keep an archive's complete payload together. Source asset resolution is covered in the [maintainer guide](https://github.com/bastani-inc/atomic/blob/main/docs/maintainer/readability-a/development-and-startup.md#path-resolution).

## Debug Command

`/debug` (hidden) writes to `~/.atomic/agent/atomic-debug.log`:
- Rendered TUI lines with ANSI codes
- Last messages sent to the LLM

Review this log for sensitive conversation content before sharing it.

## PDF and engine diagnostics

PDF conversion and engine diagnostics appear as status messages in interactive sessions
and console output otherwise. Conversion failures also include diagnostic details in
their error result. Long or noisy diagnostics may be truncated. Interactive sessions keep
only recent diagnostics; older diagnostics are discarded without removing normal chat.

Diagnostics are displayed as text, not terminal commands. RPC clients receive diagnostics
separately from JSON responses. No `atomic-engine-stderr.log` file is written; include the
displayed diagnostic and conversion error when reporting a PDF problem.

## Startup timing probes

For a startup problem, report your OS, terminal, installation method, and Atomic version. Benchmark procedures and internal timing interpretation live in [startup measurement notes](https://github.com/bastani-inc/atomic/blob/main/docs/maintainer/readability-a/development-and-startup.md#startup-timing-probes).

## Testing

Repository checks and test commands live in [maintainer testing instructions](https://github.com/bastani-inc/atomic/blob/main/docs/maintainer/readability-a/development-and-startup.md#testing).

### Installed package smoke test

For release-package validation, use the [installed-package smoke test](https://github.com/bastani-inc/atomic/blob/main/docs/maintainer/readability-a/development-and-startup.md#installed-package-smoke-test).

## Deterministic installs

Package-manager installs use Atomic's published shrinkwrap. Contributor regeneration instructions live in [deterministic installs](https://github.com/bastani-inc/atomic/blob/main/docs/maintainer/readability-a/development-and-startup.md#deterministic-installs).

## Release security boundary

Download official releases through the [installation instructions](/getting-started/installation). Maintainers should follow the [release pipeline](https://github.com/bastani-inc/atomic/blob/main/docs/ci.md#direct-release-trigger-and-recovery).

## Project Structure

For the repository package map, see [project structure](https://github.com/bastani-inc/atomic/blob/main/docs/maintainer/readability-a/development-and-startup.md#project-structure).
