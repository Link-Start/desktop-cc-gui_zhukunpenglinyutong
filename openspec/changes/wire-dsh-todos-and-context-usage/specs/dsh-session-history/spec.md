## ADDED Requirements

### Requirement: History page projections seed DSH todos and occupancy
`load_dsh_session` / DSH history parse SHALL read `projections.values.todos`, `contextPressure`, and `contextBreakdown` when the host includes them. These values SHALL hydrate the same thread snapshots used by live mux. History MUST NOT invent occupancy by summing billed `tokenUsage` buckets.

#### Scenario: History values survive load
- **WHEN** `session.history` returns `projections.values` containing `todos`, `contextPressure`, and `contextBreakdown`
- **THEN** the opened DSH thread MUST expose those snapshots to Composer
- **AND** billed `tokenUsage` / `sessionStats` MUST still load as they do today
