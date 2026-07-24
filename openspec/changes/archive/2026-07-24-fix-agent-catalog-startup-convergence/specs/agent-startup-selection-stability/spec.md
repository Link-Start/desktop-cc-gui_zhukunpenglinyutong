## ADDED Requirements

### Requirement: Agent Startup Selection Recovery MUST Have An Acyclic Trigger Graph

AppShell selected-agent recovery MUST NOT subscribe to a React cache state that the same recovery effect writes. Internal cache hydration MAY notify render consumers, but that notification MUST NOT re-trigger reload solely because its own cache write changed reference identity.

#### Scenario: persisted selected agent hydration converges without self-trigger
- **WHEN** cold startup reload hydrates a persisted thread-scoped selected agent into memory
- **THEN** the cache MAY publish one logical React state change
- **AND** that cache write MUST NOT by itself invoke another reload cycle
- **AND** AppShell MUST NOT throw React `Maximum update depth exceeded`

#### Scenario: equivalent selected agent is a no-op
- **WHEN** startup recovery resolves a selected agent logically equal to the current memory and persisted entries
- **THEN** the system MUST reuse the previous React cache state reference
- **AND** the system MUST NOT rewrite the persisted value

### Requirement: Built-In Agent Catalog Readiness MUST Converge Deterministically

Persisted built-in agent selection MUST remain stable while the catalog is pending and MUST be reconciled exactly once after the current catalog becomes ready.

#### Scenario: valid persisted built-in agent survives async catalog readiness
- **WHEN** an existing thread has a persisted built-in selected agent
- **AND** the built-in catalog changes from pending to ready during cold startup
- **THEN** the active thread MUST resolve to the matching ready-catalog agent
- **AND** the selection MUST NOT transiently clear solely because the catalog was pending

#### Scenario: unavailable persisted built-in agent is cleared once
- **WHEN** the ready built-in catalog no longer contains the persisted selected agent
- **THEN** the system MUST clear the invalid thread selection
- **AND** repeated renders with the same ready catalog MUST NOT repeat the storage write

### Requirement: Agent Selection Identity Migration MUST Preserve Continuity

When a pending thread identity becomes canonical during startup, the canonical session key MUST inherit the latest selected-agent snapshot before the active selection is published.

#### Scenario: pending-to-canonical migration overlaps catalog readiness
- **WHEN** a pending thread with a persisted built-in selected agent finalizes to its canonical identity
- **AND** agent catalog readiness settles in the same startup window
- **THEN** the canonical thread MUST resolve to the same logical selected agent
- **AND** React StrictMode replay MUST converge within a bounded number of renders

### Requirement: AppShell MUST Have A Single Automatic Agent Catalog Reload Owner

AppShell MUST NOT start duplicate agent catalog reloads from multiple mount effects for the same settings lifecycle transition.

#### Scenario: cold startup with settings closed
- **WHEN** AppShell mounts with Settings closed
- **THEN** exactly one AppShell-owned automatic catalog reload MUST be requested for that lifecycle transition

#### Scenario: settings closes after agent configuration
- **WHEN** Settings changes from open to closed
- **THEN** AppShell MUST refresh agent configuration and reload the catalog
- **AND** the refresh MUST preserve existing selected-agent recovery semantics

### Requirement: Agent Startup Regression Coverage MUST Exercise Combined Recovery

The frontend test suite MUST cover the combined startup path rather than relying only on isolated catalog and selection helper tests.

#### Scenario: StrictMode regression covers persisted catalog and identity state
- **WHEN** selected-agent startup orchestration is changed
- **THEN** regression tests MUST cover persisted built-in selection, async catalog readiness and pending-to-canonical migration
- **AND** tests MUST assert bounded storage writes and absence of React maximum-depth failures
