## ADDED Requirements

### Requirement: Provider Continuation MUST Use Product-Controlled Confirmation

Provider Continuation MUST use a product-controlled, accessible dialog to preview and confirm the target and any degradation before creating target-side effects. The flow MUST NOT use browser or platform-native alert/confirm dialogs.

#### Scenario: user previews a continuation target

- **WHEN** the user chooses an available destination Provider Profile
- **THEN** the system MUST present the source, destination CLI, and Provider Profile in a product-controlled dialog
- **AND** MUST NOT create the target Native Session until the user confirms

#### Scenario: compilation requires degraded confirmation

- **WHEN** the first confirmation produces `confirmation-required`
- **THEN** the same product-controlled dialog MUST present mode, omissions, token estimate, and adapter drops
- **AND** the system MUST NOT create the target Native Session until the user explicitly accepts that degradation

#### Scenario: native confirmation APIs remain unused

- **WHEN** the continuation requires confirmation or reports an error
- **THEN** the UI MUST render the state using application components
- **AND** MUST NOT invoke `window.alert`, `window.confirm`, Tauri `ask`, or Tauri `confirm`

### Requirement: Provider Continuation Capability Boundaries MUST Be Visible

The destination picker MUST expose registered CLIs and Provider Profiles with their verified continuation-target capability state. An engine verified only as a source MUST remain disabled as a destination with a human-readable reason.

#### Scenario: Kimi is source-only

- **WHEN** Kimi is registered but continuation target acceptance has not been verified
- **THEN** the destination picker MUST keep Kimi visible but disabled
- **AND** MUST explain that Kimi can be a source while target continuation is not yet available

### Requirement: Provider Continuation MUST Expose Readable Identity And Source Navigation

A ready Provider Continuation MUST have a human-readable title and a discoverable relationship to its source Session.

#### Scenario: continuation becomes ready

- **WHEN** a Provider Continuation target Session reaches ready
- **THEN** its sidebar/canvas identity MUST use a readable title instead of a protocol marker
- **AND** the canvas MUST expose source and target snapshots
- **AND** the user MUST be able to open the source Session when it is still available

#### Scenario: source session is unavailable

- **WHEN** the recorded source Session no longer exists or is inaccessible
- **THEN** the continuation identity MUST remain readable from frozen snapshots
- **AND** source navigation MUST be disabled with an explicit explanation
