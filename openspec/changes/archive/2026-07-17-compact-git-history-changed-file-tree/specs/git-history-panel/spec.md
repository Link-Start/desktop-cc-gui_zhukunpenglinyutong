## ADDED Requirements

### Requirement: Git History changed files tree compacts safe directory chains

The Git History selected-commit changed files tree and Push Preview changed files tree SHALL render consecutive directories as one dot-separated compact folder row only while every traversed directory has no direct files and exactly one child directory. The system MUST preserve repository-root visibility, canonical path identity, expansion behavior, file status, diff statistics, selection, and file-diff opening behavior.

#### Scenario: Single-child package path is compacted

- **WHEN** a changed file is located under a consecutive directory chain with no direct files or sibling directories
- **THEN** the tree SHALL render that chain as one dot-separated folder row
- **AND** the row SHALL use the deepest directory path as its canonical expansion identity

#### Scenario: Directory branch stops compaction

- **WHEN** a directory has two or more child directories
- **THEN** the tree SHALL keep that directory as the current compact boundary
- **AND** each child chain MAY compact independently below that boundary

#### Scenario: Direct file stops compaction

- **WHEN** a directory contains a direct changed file and one child directory
- **THEN** the tree SHALL NOT compact across that directory boundary
- **AND** the direct file and child directory SHALL remain visible at the correct hierarchy level

#### Scenario: Repository root remains explicit

- **WHEN** a repository label is available for the selected Git History scope
- **THEN** the tree SHALL render the repository root as its own folder row
- **AND** compact directory projection SHALL begin below that root

#### Scenario: Compatible path identities survive compact labels

- **WHEN** POSIX and Windows-style paths are projected or two real folder paths produce the same dotted display label
- **THEN** path separators SHALL be normalized for hierarchy construction
- **AND** each real folder path SHALL retain a distinct stable row identity

#### Scenario: Existing file interactions remain path-based

- **WHEN** the user expands a compact folder or selects a changed file
- **THEN** folder state SHALL be updated by canonical path
- **AND** file selection and diff opening SHALL continue targeting the original changed-file path
