## ADDED Requirements

### Requirement: Canonical Messages input boundary

The Messages feature MUST expose a grouped canonical input for its implementation core while retaining a legacy-compatible public façade.

#### Scenario: legacy caller reaches canonical core
- **WHEN** a caller renders `Messages` with flat `MessagesProps`
- **THEN** the façade MUST adapt the props once and render `MessagesCore` with grouped canonical inputs

### Requirement: Scope-safe canonical precedence

Canonical `ConversationState` MUST win only when its workspace/thread scope matches the active legacy caller scope.

#### Scenario: matching canonical state wins
- **WHEN** canonical state matches the active workspace and thread
- **THEN** its items、plan、user input queue、engine and runtime metadata MUST win, including explicit empty arrays

#### Scenario: mismatched canonical state is rejected
- **WHEN** canonical state belongs to another workspace or thread
- **THEN** the adapter MUST use the legacy fallback state and MUST NOT leak canonical items、plan or user input requests

### Requirement: Minimal public Messages surface

The feature public index MUST expose only stable caller-facing components and types.

#### Scenario: caller imports Messages feature
- **WHEN** layout or app-shell code imports Messages APIs
- **THEN** it MUST use `src/features/messages/index.ts`, which MUST NOT export timeline、row、toolBlock、orchestration or private helper internals
