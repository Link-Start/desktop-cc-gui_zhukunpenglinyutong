## ADDED Requirements

### Requirement: File content context menu MUST reveal the active file in the workspace tree

The file content context menu MUST provide a localized action that reveals the active file in the current workspace file tree without mutating editor or filesystem state.

#### Scenario: Reveal a deeply nested active file

- **GIVEN** the active file is nested below one or more collapsed directories
- **WHEN** the user selects `定位到文件` from the file content context menu
- **THEN** the system MUST switch the right panel to the Files surface when needed
- **AND** MUST expand every ancestor directory of the active file
- **AND** MUST make the active file the primary single selection
- **AND** MUST scroll the target file row into the nearest visible tree position

#### Scenario: Reveal through progressively loaded directories

- **GIVEN** the active file has any filename or extension and one or more ancestor directories are not yet present in the current lazy tree snapshot
- **WHEN** the user selects `定位到文件` once
- **THEN** the system MUST progressively load and expand each available ancestor using the same reveal request
- **AND** MUST reach, select, and scroll to the target without requiring another user action

#### Scenario: Repeat reveal for the same active file

- **GIVEN** the active file is already selected and visible in the file tree
- **WHEN** the user selects `定位到文件` again
- **THEN** the system MUST process a new reveal request
- **AND** MUST scroll the target row again without changing open tabs or active editor state

#### Scenario: Reveal does not mutate file or editor state

- **WHEN** a file reveal action completes
- **THEN** open tabs, active file, editor buffer, dirty state, and filesystem contents MUST remain unchanged
- **AND** the action MUST NOT invoke the operating-system Finder or Explorer reveal flow
