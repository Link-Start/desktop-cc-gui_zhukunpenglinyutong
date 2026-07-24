## ADDED Requirements

### Requirement: Slash completion fallback MUST NOT wait for an absent runtime producer

When the Tauri build has no runtime slash-command refresh producer, the composer slash completion provider MUST return its local commands immediately and MUST NOT register or await legacy JCEF global callbacks.

#### Scenario: local slash completion resolves without bridge data
- **WHEN** the user opens slash completion and no runtime callback producer exists
- **THEN** the provider MUST return the local command set without a loading timeout
- **AND** it MUST NOT read or write `window.updateSlashCommands` or `window.__pendingSlashCommands`
