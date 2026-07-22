## ADDED Requirements

### Requirement: Detached explorer MUST reveal files inside its own tree session

The detached file explorer MUST execute file-content reveal requests against its own file tree and MUST NOT project selection into the main window.

#### Scenario: Reveal while detached sidebar is collapsed

- **GIVEN** a file is active in the detached explorer and its sidebar is collapsed
- **WHEN** the user selects `定位到文件` from the file content context menu
- **THEN** the detached sidebar MUST expand
- **AND** its local file tree MUST expand the active file ancestors, select the file, and scroll the row into view

#### Scenario: Detached reveal remains session-local

- **WHEN** a detached explorer reveals its active file
- **THEN** the main window file tree selection MUST remain unchanged
- **AND** the detached explorer open tabs and active file MUST remain unchanged
