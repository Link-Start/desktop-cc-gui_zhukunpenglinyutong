## ADDED Requirements

### Requirement: Shared History Recovery MUST Remain Owned By The Shared Thread

Shared history reload MUST use the stable canonical `shared:<UUID>` identity independently from its
display title. A successful empty canonical projection MUST be treated as a valid empty Shared
Session. A projection failure MUST remain observable and retryable, and MUST NOT activate or expose
the Native history recovery card or Native automatic-recovery block.

#### Scenario: title changes after first user turn

- **WHEN** Shared Session presentation metadata changes from `Shared Session` to the first user
  message
- **THEN** Sidebar and history loading MUST continue using the original `shared:<UUID>`
- **AND** all canonical history MUST remain attached to that same Shared thread

#### Scenario: new Shared Session has no canonical turns

- **WHEN** a newly created Shared Session successfully loads an empty canonical projection
- **THEN** the history load MUST complete as a valid empty state
- **AND** the UI MUST NOT show the Native “current session needs recovery” card

#### Scenario: Shared projection temporarily fails

- **WHEN** canonical projection fails and no readable Legacy snapshot exists
- **THEN** the failure MUST remain observable in diagnostics
- **AND** selecting the Shared Session again MUST retry canonical loading
- **AND** the UI MUST NOT show the Native history recovery card
- **AND** the loader MUST NOT invoke a Native Codex or Claude history fallback

#### Scenario: Native history recovery remains unchanged

- **WHEN** a Native Session enters its existing history recovery failure state
- **THEN** the Native recovery card and action MUST remain available
- **AND** Shared-specific recovery rules MUST NOT alter that Native state
