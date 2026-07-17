## ADDED Requirements

### Requirement: Git panel groups changed files by repository when necessary
The Git panel MUST use repository grouping only when multiple dirty repositories are visible, while preserving the existing single-repository file list contract。

#### Scenario: Single repository file list
- **WHEN** commit workspace contains exactly one dirty repository
- **THEN** file rows SHALL preserve existing flat/tree layout、status、preview 与 inclusion controls
- **AND** no redundant repository group header SHALL be rendered

#### Scenario: Multi repository file list
- **WHEN** commit workspace contains multiple dirty repositories
- **THEN** each repository SHALL have an accessible group header with repository name、branch and file count
- **AND** file rows within the group SHALL preserve existing status、preview and inclusion controls

### Requirement: Repository group selection composes with file selection
Repository headers and file rows MUST expose one coherent tri-state selection model scoped to their repository。

#### Scenario: Toggle an entire repository group
- **WHEN** user toggles a repository group inclusion control
- **THEN** all committable files in that repository SHALL change inclusion state
- **AND** files in other repositories SHALL remain unchanged

#### Scenario: Repository group is partially selected
- **WHEN** only part of a repository's committable files are included
- **THEN** repository header SHALL expose mixed selection state
