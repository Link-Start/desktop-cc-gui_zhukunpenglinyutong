# multi-repository-git-commit-workspace Specification

## Purpose
TBD - created by archiving change add-multi-repository-git-commit-workspace. Update Purpose after archive.
## Requirements
### Requirement: Adaptive single and multi repository commit workspace
Git commit workspace MUST 根据 discovered repository topology 自适应渲染，single-repository workspace SHALL 保持轻量单组形态，multi-repository workspace SHALL 同时显示所有 dirty repository groups。

#### Scenario: Single repository keeps the existing compact shape
- **WHEN** active workspace 只包含一个 Git repository
- **THEN** commit panel SHALL render its changed files without an extra repository group header
- **AND** existing stage、unstage、commit、push 与 file preview behavior SHALL remain available

#### Scenario: Multiple dirty repositories render together
- **WHEN** active workspace 包含两个或更多 dirty Git repositories
- **THEN** commit panel SHALL render one group per dirty repository
- **AND** each group SHALL display repository name、current branch、changed file count 与 repository-relative files

#### Scenario: Clean repositories do not add empty commit groups
- **WHEN** multi-repository workspace 中某 repository 没有 staged、unstaged 或 untracked changes
- **THEN** commit workspace SHALL omit that empty group

### Requirement: Repository-isolated status and selection
Multi-repository commit workspace MUST use `repositoryRoot` as part of status、selection 与 mutation identity。

#### Scenario: Same relative path exists in two repositories
- **WHEN** two repository groups both contain `pom.xml`
- **THEN** selecting or staging one file SHALL affect only its owning `repositoryRoot`
- **AND** the other `pom.xml` SHALL preserve its own selection and Git state

#### Scenario: Repository status partially fails
- **WHEN** one scoped status request fails while another succeeds
- **THEN** the successful repository SHALL remain usable
- **AND** the failed repository SHALL show repository-level error state without replacing all groups with global unavailable state

#### Scenario: Workspace changes during parallel status loading
- **WHEN** status responses from a previous workspace arrive after active workspace changes
- **THEN** stale responses MUST NOT overwrite the current workspace repository model

### Requirement: Multi-repository commit executes independent repository commits
When files from multiple repositories are selected, the system MUST create an independent Git commit per repository using the shared commit message and deterministic repository order。

#### Scenario: All selected repositories commit successfully
- **WHEN** selected files span multiple repositories and user commits
- **THEN** system SHALL execute one scoped commit for each selected repository
- **AND** each successful repository SHALL refresh and clear only the selection covered by its commit

#### Scenario: One repository commit fails
- **WHEN** one scoped commit fails during a multi-repository run
- **THEN** system SHALL continue processing remaining selected repositories
- **AND** failed repository selection SHALL remain available for retry
- **AND** final feedback SHALL identify repository-level successes and failures

#### Scenario: Commit and push spans repositories
- **WHEN** user invokes commit-and-push for multiple repositories
- **THEN** system SHALL push only repositories whose commit succeeded in this run
- **AND** push failure SHALL be reported separately from commit success

### Requirement: Repository-scoped context actions do not depend on global selection
An action launched from a repository context MUST execute against that explicit repository even when the global selected repository differs or is unset。

#### Scenario: Update child repository before selecting it
- **WHEN** user invokes Update from a child repository context menu before selecting that repository globally
- **THEN** system SHALL execute update using the context repository's `repositoryRoot`
- **AND** it MUST NOT return Git status unavailable solely because selected repository state is unset

### Requirement: Git History repository selection is independent from the main workspace
In a multi-repository workspace, the bottom Git History panel MUST allow selecting a discovered repository without changing the main active workspace identity。

#### Scenario: Select a child repository in Git History
- **WHEN** user selects a discovered child repository from the Git History repository picker
- **THEN** Git History SHALL reload branch、commit、worktree and detail data for that repository
- **AND** main file tree、conversation workspace and right Git panel SHALL remain bound to the original active workspace
- **AND** selection SHALL NOT add the child repository to the workspace/worktree catalog
- **AND** Git History commands SHALL resolve the target through explicit `repositoryRoot` scope

#### Scenario: Single repository Git History
- **WHEN** active workspace contains only one Git repository
- **THEN** Git History SHALL keep the existing compact project selector behavior
- **AND** no redundant repository choice SHALL be rendered

### Requirement: Commit composer remains available at the bottom of the Git panel
For both single and multi repository diff modes, changed-file content MUST render above the commit composer and the composer MUST remain attached to the panel bottom while files scroll independently。

#### Scenario: Single repository has changed files
- **WHEN** a single repository contains staged or unstaged files
- **THEN** file sections SHALL precede the commit composer in DOM and visual order
- **AND** commit message、generation action、commit button and scope hint SHALL remain available at the bottom

#### Scenario: Multiple repositories have changed files
- **WHEN** multiple dirty repository groups exceed available panel height
- **THEN** repository groups SHALL scroll in the content region
- **AND** the shared commit composer SHALL remain visible at the bottom without covering the final file row

### Requirement: Multi-repository commit message generation uses repository-scoped diffs
The multi-repository commit composer MUST expose the same AI engine affordance as single-repository mode and MUST generate from every selected repository scope。

#### Scenario: Generate a message for selections across repositories
- **WHEN** selected commit files span two or more repositories and user invokes AI generation
- **THEN** the request SHALL identify each selection by `repositoryRoot + selectedPaths`
- **AND** the generated prompt SHALL combine only those validated repository-scoped diffs

#### Scenario: Legacy single-repository generation
- **WHEN** single-repository mode generates a commit message with `selectedPaths`
- **THEN** existing configured-root behavior SHALL remain unchanged
- **AND** no repository group chrome SHALL be required

### Requirement: Git History preserves workspace hierarchy before repository selection
Git History MUST preserve the existing workspace/worktree picker as the first selection level and MUST present repository selection as an additional second level only when needed。

#### Scenario: Multi-repository History workspace
- **WHEN** the selected History workspace contains multiple repositories
- **THEN** the original workspace/worktree picker SHALL remain visible
- **AND** a second repository picker SHALL list repositories discovered for that History workspace

#### Scenario: Single-repository History workspace
- **WHEN** the selected History workspace contains zero or one selectable repository
- **THEN** the second repository picker SHALL be omitted
- **AND** the original compact workspace/worktree structure SHALL remain unchanged

### Requirement: Multi-repository unstaged files support repository-scoped discard
The multi-repository Git commit workspace MUST expose discard only for unstaged files, MUST require explicit user confirmation, and MUST identify the mutation target by `repositoryRoot + path`.

#### Scenario: Unstaged row exposes discard action
- **WHEN** a multi-repository group renders an unstaged file
- **THEN** the file row SHALL display the shared discard action
- **AND** a staged file row SHALL NOT display that action

#### Scenario: Cancel discard leaves repository unchanged
- **WHEN** the user opens discard confirmation for a multi-repository file and cancels
- **THEN** the system MUST NOT invoke the revert mutation

#### Scenario: Confirm discard refreshes repository statuses
- **WHEN** the user confirms discard for an unstaged file
- **THEN** the system SHALL invoke revert with the owning file's explicit `repositoryRoot + path`
- **AND** successful completion SHALL refresh multi-repository statuses

#### Scenario: Same relative path is isolated by repository
- **WHEN** two repository groups both contain the same unstaged relative path and the user confirms discard in one group
- **THEN** the system SHALL revert only the file under the selected group's `repositoryRoot`
- **AND** it MUST NOT route the mutation through the other repository or global repository selection
