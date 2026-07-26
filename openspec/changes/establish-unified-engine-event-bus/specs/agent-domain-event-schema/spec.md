## MODIFIED Requirements

### Requirement: Domain Event Schema MUST Cover The Initial Eleven Event Types

The capability MUST provide schema definitions for the following eleven event types:

1. `session.started`
2. `session.ended`
3. `turn.started`
4. `turn.completed`
5. `turn.failed`
6. `message.delta.appended`
7. `message.completed`
8. `tool.started`
9. `tool.completed`
10. `usage.updated`
11. `run.settled`

Adding another event type MUST require an OpenSpec change.

#### Scenario: documented event union includes run settlement

- **WHEN** the capability is shipped
- **THEN** the exported domain event union MUST include the documented eleven event types
- **AND** `run.settled` MUST be the only generic run-completion event

### Requirement: Every Domain Event MUST Carry Common Identity Fields

Every domain event MUST include `type`、`occurredAt`、`workspaceId`、`logicalSessionId`、`runId`、`engineId` and provenance. Turn/item events MUST include applicable `turnId` / `itemId`; legacy `sessionId` and built-in `engine` projections MAY remain during migration.

#### Scenario: factories enforce runtime identity

- **WHEN** a runtime event factory is invoked without logical session、run、engine or provenance
- **THEN** typecheck or schema validation MUST reject the event

#### Scenario: occurredAt and provenance remain explicit

- **WHEN** a factory produces an event
- **THEN** `occurredAt` MUST be caller-provided ISO 8601
- **AND** provenance MUST identify the producing adapter/protocol source
