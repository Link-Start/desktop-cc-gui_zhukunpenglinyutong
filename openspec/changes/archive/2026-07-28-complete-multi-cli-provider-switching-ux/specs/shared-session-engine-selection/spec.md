## MODIFIED Requirements

### Requirement: Shared Session Uses Explicit Manual Engine Selection

Within a `shared session`, the system MUST let the user explicitly choose the execution target before sending a turn. The selector MUST be a four-level target picker (CLI → Provider → Model → Reasoning); the engine-only selector is superseded. Provider and model items MUST preserve Provider Profile scope instead of inferring the target from model id alone. The picker MUST be locked whenever the shared session composer is in any non-idle state.

#### Scenario: shared composer exposes four-level target picker

- **WHEN** the user focuses the composer inside a `shared session`
- **THEN** the system MUST show an explicit four-level execution target picker (CLI, provider profile, model, reasoning)
- **AND** the CLI level MUST show supported and known unsupported engines with an explicit availability state
- **AND** only engines supported by the current Shared Session runtime MAY be selected

#### Scenario: provider profile scopes its model catalog

- **WHEN** the user opens a Provider Profile inside the shared target picker
- **THEN** the system MUST show models resolved for that exact Engine and Provider Profile
- **AND** selecting a model MUST atomically preserve the Engine, Provider Profile, and Model identity
- **AND** an equal model id in another Provider Profile MUST NOT change or satisfy the selection

#### Scenario: unavailable engine remains explainable

- **WHEN** a registered CLI such as Kimi is not currently accepted as a Shared Session target
- **THEN** the picker MUST keep the CLI visible but disabled
- **AND** MUST expose a human-readable reason rather than silently filtering it out

#### Scenario: picker update is metadata-only before send

- **WHEN** the user changes the shared-session target picker but does not submit a message yet
- **THEN** the system MUST update only the selected next target state for that shared session
- **AND** the system MUST NOT dispatch a turn, create a binding, or start an extra user-visible native conversation solely due to picker change

#### Scenario: submitted turn uses the user-selected target

- **WHEN** the user submits a message from a `shared session`
- **THEN** the system MUST dispatch that turn to the full target (engine and provider profile) currently selected by the user
- **AND** the dispatch result MUST remain attributable to that selected target snapshot

#### Scenario: picker locks outside idle state

- **WHEN** the shared session composer is in any state other than `idle` (for example `running`, `awaiting-acceptance`, or `recovery-required`)
- **THEN** the target picker MUST be locked against changes
- **AND** the system MUST NOT apply a new target selection to the in-flight turn

#### Scenario: unsupported engines stay unavailable in shared session

- **WHEN** the user focuses the composer inside a `shared session`
- **THEN** the system MUST keep unsupported engines unavailable for selection in that shared-session picker
- **AND** the system MUST NOT route a shared-session turn through an unsupported engine
