## ADDED Requirements

### Requirement: File tabs MUST be remembered per workspace during the app session

The system SHALL keep open file tab identity and active file scoped to the current workspace while the app session is running.

#### Scenario: switching back restores workspace file tabs

- **GIVEN** workspace A has file A1 and file A2 open
- **AND** file A2 is the active file
- **WHEN** the user switches to workspace B and then back to workspace A
- **THEN** workspace A MUST restore file A1 and file A2 as open tabs
- **AND** workspace A MUST restore file A2 as the active file

#### Scenario: another workspace has independent file tabs

- **GIVEN** workspace A has file A open
- **WHEN** the user switches to workspace B and opens file B
- **THEN** workspace B MUST show only workspace B's file tab state
- **AND** workspace A's open tab memory MUST remain available for later restoration

#### Scenario: closing all tabs clears only the current workspace

- **GIVEN** workspace A and workspace B each have open file tabs
- **WHEN** the user closes all file tabs while workspace A is active
- **THEN** workspace A MUST clear its file tab state
- **AND** workspace B MUST retain its file tab state
