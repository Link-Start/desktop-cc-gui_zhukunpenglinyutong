# openspec-trellis-status-panel-bridge delta — remove-kanban-and-task-center

## MODIFIED Requirements

### Requirement: Orchestration Center SHALL Not Perform Background Governance Sync

The orchestration flow SHALL NOT introduce background synchronization that writes OpenSpec, Trellis, agent-rule, script, or workflow state.

#### Scenario: no automatic checkbox update

- **WHEN** a linked orchestration task changes state
- **THEN** the system SHALL NOT automatically check or uncheck lines in OpenSpec, Trellis, or other provider task files
- **AND** the system SHALL NOT treat a deleted TaskRun / Task Center record as a write trigger

#### Scenario: explicit governance write remains provider-specific workflow

- **WHEN** user wants to update governance artifacts from orchestration results
- **THEN** the system SHALL require an explicit provider action or separate workflow
- **AND** the action SHALL disclose the provider and files that may be written before writing
