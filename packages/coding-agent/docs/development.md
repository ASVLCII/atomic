# Development

For extensions and SDK integrations, start with [Build with Atomic](/build).

## Setup

To install the released CLI, follow [Installation](/getting-started/installation).

<a id="forking--rebranding"></a>

## Path Resolution

Atomic supports package-manager installs and standalone archives. Keep an archive's complete payload together.

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

For a startup problem, report your OS, terminal, installation method, and Atomic version.

<a id="testing"></a>
<a id="installed-package-smoke-test"></a>

## Deterministic installs

Package-manager installs use Atomic's published shrinkwrap.

## Release security boundary

Download official releases through the [installation instructions](/getting-started/installation). Maintainers should follow the [release pipeline](https://github.com/bastani-inc/atomic/blob/main/docs/ci.md#direct-release-trigger-and-recovery).

<a id="project-structure"></a>

For source setup and repository checks, see [DEV_SETUP.md](https://github.com/bastani-inc/atomic/blob/main/DEV_SETUP.md).
