# multi-repository-file-tree-decorations Specification

## Purpose
TBD - created by archiving change fix-multi-repository-file-tree-decorations. Update Purpose after archive.
## Requirements
### Requirement: Aggregate repository summaries SHALL carry compact file decorations

The repository summary read model SHALL expose repository-relative compact file status entries for every successfully opened repository without issuing per-repository frontend polling requests.

#### Scenario: Multiple repositories contain changes

- **WHEN** bounded discovery finds two or more repositories with changed files
- **THEN** each repository summary SHALL include its own normalized `path + status` entries
- **AND** the entries SHALL be collected during the existing aggregate status scan

#### Scenario: Repository is unavailable

- **WHEN** one repository cannot be opened or its status cannot be read
- **THEN** that repository SHALL expose its row-local error and an empty decoration collection
- **AND** sibling repository decorations SHALL remain available

#### Scenario: Compact payload is serialized remotely

- **WHEN** repository summaries are returned through remote daemon mode
- **THEN** local desktop and remote daemon responses SHALL preserve the same decoration field semantics
- **AND** the payload MUST NOT include diff content, additions/deletions, or commit history

### Requirement: Repository-relative decorations SHALL project to safe workspace paths

The frontend SHALL normalize each repository-relative decoration at the boundary and SHALL combine it with the explicit repository identity before applying file-tree status.

#### Scenario: Nested repository file is changed

- **WHEN** repository `services/api` returns changed path `src/index.ts`
- **THEN** the workspace file tree SHALL decorate `services/api/src/index.ts`
- **AND** its visible ancestor folders SHALL receive the corresponding folder status

#### Scenario: Workspace root repository file is changed

- **WHEN** the root repository returns changed path `src/index.ts`
- **THEN** the workspace file tree SHALL decorate `src/index.ts` without adding a synthetic prefix

#### Scenario: Decoration path is malformed

- **WHEN** a decoration contains an absolute path, platform prefix, empty path, or parent traversal component
- **THEN** the frontend MUST discard that entry
- **AND** it MUST NOT decorate a path outside the visible workspace tree

#### Scenario: Legacy payload omits decorations

- **WHEN** an older compatible backend returns a repository summary without the additive decoration field
- **THEN** the frontend SHALL normalize the field to an empty collection
- **AND** existing branch/count summary rendering SHALL continue to work

### Requirement: File tree SHALL preserve folder icons while expressing Git state through text

Repository identity and changed-descendant state SHALL NOT replace or recolor the original file-tree folder icon.

#### Scenario: Exact repository folder is clean

- **WHEN** a folder path exactly matches a clean repository summary
- **THEN** the row SHALL use the same closed/open folder icon selected by the existing file icon resolver
- **AND** it SHALL NOT render a repository-specific icon color or corner marker

#### Scenario: Folder contains changed descendants

- **WHEN** a repository folder or ordinary folder contains changed files
- **THEN** its folder name SHALL use the resolved Git status color
- **AND** its folder icon SHALL retain the original style

### Requirement: Repository summary tokens SHALL use theme-aware semantic colors

Branch and working-tree summary tokens SHALL expose distinct semantic states using existing theme variables so they remain readable in light, dark, system, and custom themes.

#### Scenario: Clean repository is displayed

- **WHEN** a repository has a current branch and no working-tree changes
- **THEN** the branch token SHALL use a theme-aware accent treatment
- **AND** the clean token SHALL use success semantics

#### Scenario: Dirty repository is displayed

- **WHEN** a repository has staged, modified, or untracked changes
- **THEN** dirty count tokens SHALL use warning or status-specific semantic colors distinct from the branch token

#### Scenario: Conflict or unavailable repository is displayed

- **WHEN** a repository is conflicted or unavailable
- **THEN** the affected token SHALL use error semantics
- **AND** the UI SHALL NOT present it as a clean repository

#### Scenario: IDEA-inspired palette follows the active theme

- **WHEN** the app switches between dark, explicit light, or system-light theme
- **THEN** Git file/folder states SHALL resolve through shared theme-level `--git-status-*` tokens
- **AND** branch tokens SHALL use the dedicated warm-orange `--git-branch` color rather than file status or generic accent colors

#### Scenario: Changed file or folder is displayed

- **WHEN** a file, ordinary ancestor folder, or exact repository folder has a resolved Git status
- **THEN** its visible name SHALL use `font-weight: 550`
- **AND** unchanged names SHALL retain the existing normal weight
- **AND** file/folder icons SHALL remain unaffected

#### Scenario: Dirty sibling repositories contain different mutation types

- **WHEN** two exact repository folders are dirty because of different descendant statuses
- **THEN** both repository folder names SHALL use the shared theme-aware dirty repository blue
- **AND** descendant files and ordinary folders SHALL continue using their status-specific IDEA palette
- **AND** clean repository folder names SHALL retain the normal text color

#### Scenario: Repository branch token is displayed

- **WHEN** a repository branch token is rendered in the file tree or Composer repository selector
- **THEN** it SHALL use the warm-orange `--git-branch` token
- **AND** it SHALL use `font-weight: 600` without changing sync/count token weight

### Requirement: Multi-repository decoration refresh SHALL remain bounded and stale-safe

Decoration refresh SHALL reuse repository summary lifecycle guarantees and SHALL NOT introduce a high-frequency root render producer.

#### Scenario: Aggregate refresh settles

- **WHEN** a summary refresh returns updated decorations for the active workspace
- **THEN** all repository file/folder decorations SHALL converge from that aggregate response
- **AND** no repository-specific polling loop SHALL be created

#### Scenario: Workspace changes during refresh

- **WHEN** a prior workspace aggregate response resolves after the active workspace changes
- **THEN** its summaries and decorations SHALL be discarded by the existing stale-result guard
- **AND** current workspace decorations SHALL remain unchanged
