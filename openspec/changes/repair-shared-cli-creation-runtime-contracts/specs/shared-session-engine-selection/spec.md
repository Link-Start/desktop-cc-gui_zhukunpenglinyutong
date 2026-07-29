## ADDED Requirements

### Requirement: Shared Session Creation MUST Explicitly Select A Ready CLI

The Sidebar `Shared CLI` creation action MUST expose a second-level selector containing every Shared-supported CLI. Selecting a ready CLI MUST create the Shared Session with that CLI as the initial target engine. The system MUST NOT infer the initial engine or Model from the currently active Composer.

#### Scenario: create Shared Session with a different active engine

- **WHEN** the active Composer targets Claude and the user selects Grok from the `Shared CLI` submenu
- **THEN** the new Shared Session MUST use Grok as its initial target engine
- **AND** it MUST NOT copy the Claude Composer Provider, Model, or Reasoning selection

#### Scenario: unavailable CLI remains diagnosable

- **WHEN** a Shared-supported CLI is not ready in the selected workspace
- **THEN** its submenu item MUST be disabled with the current availability reason
- **AND** the system MUST NOT create a partial Shared Session

#### Scenario: selected CLI resolves a complete local target

- **WHEN** the user selects a ready CLI from the Shared creation submenu
- **THEN** the system MUST resolve that CLI's canonical local Provider and runtime-authoritative default Model
- **AND** it MUST persist a complete initial `ExecutionTarget` before opening the session
