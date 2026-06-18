## ADDED Requirements

### Requirement: Codex Backend Phase Timing Diagnostics MUST Be Content Safe
Codex backend phase timing diagnostics MUST remain bounded and content-safe while exposing enough timestamps to split post-ack first-delta latency.

#### Scenario: backend timing metadata excludes conversation content
- **WHEN** backend enriches a Codex app-server event with `ccguiTiming`
- **THEN** the timing metadata MUST include only ids, method/source labels, timestamps, durations, and bounded counters
- **AND** it MUST NOT include prompt text, assistant text, tool output, terminal output, or file content

#### Scenario: malformed or missing timing remains safe
- **WHEN** an app-server event lacks timing metadata or contains malformed timing fields
- **THEN** renderer diagnostics MUST ignore or normalize those fields without throwing
- **AND** report generation MUST mark unavailable metrics as unsupported rather than inventing proxy values
