## ADDED Requirements

### Requirement: AppShell Feature Projections MUST Not Create Parent Render Feedback Loops

AppShell feature hooks that mirror storage or derived collections into local React state MUST preserve the previous state reference when the observable projection is unchanged, even when an input collection receives a new reference.

#### Scenario: Equivalent workspace projection remains idempotent

- **WHEN** an AppShell render supplies a newly allocated `workspaces` array with unchanged ids and names
- **AND** Quick Switcher recent-file storage has not changed
- **THEN** `useQuickSwitcherRecentFiles` MUST preserve its previous groups reference
- **AND** the effect MUST NOT schedule an unbounded parent render chain or React error #185

#### Scenario: A real recent-file transition still publishes

- **WHEN** Quick Switcher receives `QUICK_SWITCHER_RECENT_FILES_CHANGED`
- **AND** the projected recent-file groups differ from current state
- **THEN** the hook MUST publish the new groups
- **AND** the matching recent file MUST remain visible through the Quick Switcher surface

#### Scenario: AppShell startup converges with empty activity

- **GIVEN** startup has a valid empty `workspaceActivity.timeline`
- **AND** shell section inputs may be reconstructed between renders
- **WHEN** AppShell initializes Quick Switcher recent-file state
- **THEN** startup MUST converge without `Maximum update depth exceeded` or heap exhaustion
