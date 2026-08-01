## ADDED Requirements

### Requirement: Cold-start sibling projections MUST NOT publish workspace-derived equivalent state

AppShell cold-start hooks MUST keep persisted/event-owned source snapshots separate from workspace-derived projections. An equivalent `workspaces` collection reference change MUST NOT schedule a React state update, and a real storage or workspace catalog change MUST still update the visible projection.

#### Scenario: Equivalent workspace catalog is recreated during hydration
- **WHEN** cold-start hydration recreates a `workspaces` array with the same ordered `id/name` values
- **THEN** Quick Switcher recent-file source state MUST retain its previous reference
- **AND** AppShell MUST NOT reach React `Maximum update depth exceeded` or minified error `#185`

#### Scenario: Storage changes before the listener is attached
- **WHEN** a sibling cold-start effect updates recent-file storage before the Quick Switcher listener effect attaches
- **THEN** the post-subscription refresh MUST observe the latest normalized snapshot exactly once
- **AND** the visible recent-file groups MUST include the real change

#### Scenario: Workspace name changes
- **WHEN** a workspace keeps its identity but its observable name changes
- **THEN** the projected recent-file group MUST publish the new workspace name
- **AND** no client-store schema migration MUST be required
