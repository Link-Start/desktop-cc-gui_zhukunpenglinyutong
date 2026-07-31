## ADDED Requirements

### Requirement: Shared And Home Atomic Pickers MUST Enable Five CLIs

Shared Session and New Home Atomic target pickers MUST expose Claude Code、Codex CLI、
Kimi CLI、Grok CLI and OpenCode CLI as enabled creation/execution targets. Native Session
selector behavior MUST remain unchanged.

#### Scenario: Shared picker lists five enabled CLI rows

- **WHEN** a user opens the Shared Session target picker
- **THEN** Claude、Codex、Kimi、Grok and OpenCode rows MUST be enabled
- **AND** selecting any row MUST display that CLI's Provider Profiles in the right panel

#### Scenario: Home picker creates a newly supported target

- **WHEN** a user selects a Kimi、Grok or OpenCode Provider Model from New Home
- **THEN** Home MUST create one complete create-session target
- **AND** the new Native Session and first Turn MUST use that Engine、Provider and runtime Model

#### Scenario: Native session remains unchanged

- **WHEN** a user opens an existing Kimi、Grok or OpenCode Native Session selector
- **THEN** the selector MUST preserve its existing Native behavior
- **AND** this Shared integration MUST NOT add cross-CLI mutation to the Native Session
