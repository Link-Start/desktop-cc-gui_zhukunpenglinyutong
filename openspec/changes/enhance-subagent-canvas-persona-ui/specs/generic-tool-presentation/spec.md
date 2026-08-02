# generic-tool-presentation Delta

## ADDED Requirements

### Requirement: Subagent tools may use persona presentation

When a tool item is recognized as a subAgent (`Agent` / `Task` or equivalent task-like type), the conversation canvas MUST be allowed to render it via the subagent persona card or squad grid presentation instead of the generic tool flat row as the primary surface.

#### Scenario: agent tool prefers persona surface

- **WHEN** a conversation tool item is classified as subAgent for canvas rendering
- **THEN** the primary visible surface MAY be the persona card or squad grid
- **AND** specialized ExitPlan / file-change / image-view variants MUST remain unaffected

#### Scenario: non-subagent tools unchanged

- **WHEN** a tool item is not classified as subAgent
- **THEN** generic tool presentation projection and GenericToolBlock ownership rules MUST remain unchanged
