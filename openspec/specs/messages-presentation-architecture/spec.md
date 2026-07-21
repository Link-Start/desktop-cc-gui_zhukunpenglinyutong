# messages-presentation-architecture Specification

## Purpose
TBD - created by archiving change refactor-messages-presentation-architecture. Update Purpose after archive.
## Requirements
### Requirement: Messages presentation refactor preserves observable behavior
The messages presentation subsystem SHALL preserve existing user-visible UI, interaction semantics, DOM contracts, streaming output, history rendering, runtime recovery, and public imports while internal modules are reorganized.

#### Scenario: Existing conversation behavior remains equivalent
- **WHEN** the refactored messages presentation pipeline renders any existing covered conversation state
- **THEN** existing focused regression tests SHALL observe the same visible content, actions, boundaries, prompts, recovery surfaces, and navigation behavior

### Requirement: Stable timeline and live tail remain separate update lanes
The subsystem SHALL keep stable timeline derivations separate from high-frequency live assistant and reasoning updates.

#### Scenario: Live text grows during a turn
- **WHEN** the active assistant text receives additional streaming deltas
- **THEN** the live row SHALL update without requiring stable grouping, anchor, final-boundary, or full-history derivations to follow every delta

### Requirement: Timeline dependencies use responsibility-specific typed models
`MessagesTimeline` SHALL receive responsibility-specific typed models instead of an unstructured flat prop surface or a mega Context provider.

#### Scenario: Timeline receives presentation inputs
- **WHEN** `Messages` assembles the timeline view
- **THEN** stable snapshot, live state, runtime state, navigation, interactions, presentation options, and slots SHALL remain explicit and independently memoizable

### Requirement: Messages feature dependencies remain unidirectional
The refactored module SHALL enforce the dependency direction `components -> orchestration -> timeline -> rows -> Markdown/toolBlocks` and SHALL NOT introduce reverse imports or circular barrel dependencies.

#### Scenario: Row component imports are inspected
- **WHEN** row modules are analyzed after migration
- **THEN** they SHALL NOT import timeline or orchestration modules

### Requirement: Stable public entry paths preserve existing imports
Existing public entry paths for `Messages`, `MessagesTimeline`, and exports from `MessagesRows` SHALL remain valid during and after the migration.

#### Scenario: Existing call sites compile
- **WHEN** repository call sites retain their current imports
- **THEN** TypeScript SHALL resolve the same public symbols without requiring a cross-repository import rewrite

### Requirement: Refactor completion requires repository quality evidence
The change SHALL NOT be considered complete until focused messages tests, frontend type checking, linting, full tests, large-file governance, heavy-test-noise governance, OpenSpec strict validation, and diff checks pass or any pre-existing unrelated failure is explicitly evidenced.

#### Scenario: Completion is audited
- **WHEN** implementation reaches the cleanup phase
- **THEN** the required commands SHALL be executed and their outputs SHALL be reviewed before completion is reported

