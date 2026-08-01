# shared-markdown-renderer Specification

## Purpose
TBD - created by archiving change promote-shared-markdown-renderer. Update Purpose after archive.
## Requirements
### Requirement: Markdown has a neutral shared owner

Reusable Markdown implementation and runtime support MUST live under `src/markdown/**` and MUST NOT
depend on messages private modules.

#### Scenario: peer feature renders Markdown
- **WHEN** a non-messages feature renders Markdown
- **THEN** it MUST import the canonical shared owner
- **AND** output、links、images、math and accessibility MUST match the prior implementation

### Requirement: Streaming and heavy rendering contracts are preserved

Streaming value scheduling、heavy code/table deferral and lazy runtime boundaries MUST remain stable.

#### Scenario: streaming Markdown advances
- **WHEN** live Markdown receives progressive updates
- **THEN** timers、cleanup、throttle and reveal policy MUST match the existing contract

#### Scenario: heavy or lazy island renders
- **WHEN** code、table、Mermaid or full Markdown runtime is deferred
- **THEN** it MUST retain the existing placeholder and lazy chunk behavior

### Requirement: Local resources use pure normalization

Local file/image/resource token normalization MUST be owned by pure helpers and preserve Windows、POSIX、
file URL、asset URL and fragmented token behavior.

#### Scenario: local Markdown resource renders
- **WHEN** Markdown contains a supported local file or image reference
- **THEN** normalized href/src and fallback path MUST match the previous behavior
