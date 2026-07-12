## ADDED Requirements

### Requirement: Codex Startup Detection MUST Be Metadata-Only

The system MUST avoid executing the Codex CLI during startup/background engine
detection. Startup detection MAY resolve configured binary paths, PATH candidates,
home directory, and built-in model metadata, but MUST NOT run `codex --version`,
`codex --help`, or `codex app-server --help`.

#### Scenario: startup detection does not trigger Codex process execution

- **WHEN** the client opens and calls `detect_engines`
- **AND** the local environment resolves a Codex binary
- **THEN** Codex status detection SHALL report metadata from path resolution and built-in catalog data
- **AND** detection SHALL NOT execute the resolved Codex binary.

#### Scenario: active Codex usage still verifies capability

- **WHEN** the user explicitly starts a Codex runtime, runs Codex doctor, or uses the Codex installer post-check
- **THEN** those active verification paths MAY execute bounded Codex probes such as `codex --version` or `codex app-server --help`
- **AND** failures SHALL be surfaced as actionable Codex-specific diagnostics instead of startup-time macOS security dialogs.
