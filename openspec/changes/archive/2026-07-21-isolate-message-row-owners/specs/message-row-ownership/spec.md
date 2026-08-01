## ADDED Requirements

### Requirement: Isolated message row owners

Message、reasoning and working presentation MUST have distinct component owners behind a compatibility export surface.

#### Scenario: existing timeline imports row components
- **WHEN** timeline code imports from `components/MessagesRows.tsx`
- **THEN** it MUST receive re-exported canonical row components without DOM or prop contract drift

### Requirement: Row-local streaming work

High-frequency live text and reasoning updates MUST remain subscribed at row level.

#### Scenario: assistant text streams
- **WHEN** live assistant text changes
- **THEN** `MessageRow` MUST own the live text subscription and MUST NOT lift delta-driven state into timeline or MessagesCore

### Requirement: Owned deferred media lifecycle

Deferred image hydration MUST have one hook owner with scope-safe stale guards and object URL cleanup.

#### Scenario: request scope changes before hydration completes
- **WHEN** workspace、message or locator identity changes before an async image request resolves
- **THEN** the stale request MUST NOT commit state and any owned object URL it produced MUST be revoked

#### Scenario: row unmounts
- **WHEN** a row owning hydrated image object URLs unmounts
- **THEN** every owned URL MUST be revoked exactly once

### Requirement: Complete memo equality

Message row memo equality MUST compare all render-affecting item and row props while ignoring irrelevant object identity changes.

#### Scenario: render-affecting field changes
- **WHEN** text、final state、engine/agent metadata、image/deferred image scope、browser context or intent canvas attachment changes
- **THEN** the comparator MUST request a rerender

#### Scenario: completed item is cloned without display changes
- **WHEN** a completed message item is cloned with equivalent render-affecting values
- **THEN** the comparator MUST allow memo reuse
