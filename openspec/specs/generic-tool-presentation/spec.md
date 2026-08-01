# generic-tool-presentation Specification

## Purpose
TBD - created by archiving change decompose-generic-tool-presentation. Update Purpose after archive.
## Requirements
### Requirement: Generic tool presentation has one pure projection owner

Generic tool variant normalization MUST be built by a pure presentation function that does not
depend on React、i18n or component modules.

#### Scenario: tool item is projected

- **WHEN** a generic tool conversation item is prepared for rendering
- **THEN** normalized status、summary、parsed args、variant payload and hydration weight MUST come from one presentation model
- **AND** specialized components MUST NOT independently re-parse the source item

### Requirement: Specialized tool variants preserve behavior

ExitPlan、file-change and image-view variants MUST render through focused content components while
preserving the existing public props、DOM/a11y contract and user actions.

#### Scenario: ExitPlan variant renders

- **WHEN** an ExitPlan payload is recognized
- **THEN** plan sections、copy state and execution mode actions MUST match the existing behavior

#### Scenario: file-change variant renders

- **WHEN** a tool item contains file changes or diff/stat fallback data
- **THEN** paths、change kinds、diff preview and additions/deletions MUST match the existing behavior

#### Scenario: image-view variant renders

- **WHEN** an image-view-like item contains preview or local fallback candidates
- **THEN** preview loading and fallback rendering MUST match the existing behavior

### Requirement: Common shell and hydration remain centralized

`GenericToolBlock` MUST remain the owner of marker/title/status shell、expand/collapse、canonical copy、
heavy output hydration and variant dispatch.

#### Scenario: heavy generic output renders

- **WHEN** raw output exceeds the established hydration threshold
- **THEN** canonical copy data MUST remain available
- **AND** heavy detail MUST stay deferred until the existing reveal condition is met

#### Scenario: unknown tool renders

- **WHEN** no specialized variant matches
- **THEN** the generic fallback MUST preserve completed、processing and failed status behavior
