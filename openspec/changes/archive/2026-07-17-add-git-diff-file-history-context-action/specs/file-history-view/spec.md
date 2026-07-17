## ADDED Requirements

### Requirement: Git Diff Changed-File Rows Expose Repository-Scoped File History

The File History capability SHALL accept navigation from Git Diff changed-file rows in single-repository and multi-repository modes through the existing `FileHistoryTarget` contract. This entry SHALL reuse the independent File History workspace and existing path-scoped history/diff commands.

#### Scenario: Git Diff opens the existing File History workspace

- **WHEN** a valid Git Diff row activates `Git -> 显示文件历史`
- **THEN** the host SHALL set the clicked file's `FileHistoryTarget`
- **AND** it SHALL switch to the existing File History center surface
- **AND** it SHALL NOT create a second history renderer or issue a Git mutation.

#### Scenario: Git Diff entry preserves target path domains

- **WHEN** the clicked row belongs to a nested repository
- **THEN** `repositoryRoot` and `displayPath` SHALL be workspace-relative
- **AND** `path` SHALL be repository-relative
- **AND** the existing File History query SHALL receive the exact `repositoryRoot + path`.

#### Scenario: Unsupported Git Diff host omits File History

- **WHEN** Git Diff is rendered without `onOpenFileHistory` or without a valid workspace/repository target
- **THEN** the File History action MUST NOT be shown
- **AND** the existing File History workspace state MUST remain unchanged.
