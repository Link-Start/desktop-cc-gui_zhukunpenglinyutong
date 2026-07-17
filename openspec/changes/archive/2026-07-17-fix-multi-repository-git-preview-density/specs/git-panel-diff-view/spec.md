## ADDED Requirements

### Requirement: Multi-Repository Changed-File Preview Preserves Repository Identity

The Git Diff panel MUST open multi-repository changed-file modal previews using repository-scoped identity and MUST reuse the canonical editable review surface.

#### Scenario: Open preview from a multi-repository file row

- **WHEN** 用户点击 multi-repository changed-file row 的 modal preview action
- **THEN** Git Diff panel MUST 打开现有 unified preview modal
- **AND** patch 与 full-context diff reads MUST 使用该 row 所属的 `repositoryRoot`
- **AND** workspace edit target MUST resolve through the same repository root

#### Scenario: Same relative path exists in different repositories

- **WHEN** 两个 repository 都包含相同 repository-relative `filePath`
- **AND** 用户依次请求两个文件的 preview
- **THEN** modal MUST 展示最后一次请求 repository 的 diff
- **AND** earlier stale response MUST NOT overwrite the latest preview state

#### Scenario: Single-repository preview remains unchanged

- **WHEN** Git Diff panel 不处于 multi-repository mode
- **THEN** changed-file preview MUST continue using the existing single-repository `diffEntries` path
- **AND** system MUST NOT add a repository-scoped diff request to that existing activation path

#### Scenario: Selected single-repository preview loads editable baseline

- **WHEN** 左侧 Git panel 已选择 explicit `gitRoot` 并打开 changed-file preview
- **THEN** existing `diffEntries` MUST 继续作为 patch source
- **AND** editable compare baseline/full-context reads MUST 使用当前 `gitRoot`
- **AND** loading MUST settle to content or an explicit unavailable/error state

#### Scenario: Preview context changes while a request is in flight

- **WHEN** preview 打开或 repository-scoped request pending 时 `workspaceId`、single/multi mode 或 single-mode `gitRoot` 发生变化
- **THEN** previous request generation MUST become stale
- **AND** previous modal MUST close before it can edit against the new workspace context
- **AND** a late response MUST NOT reopen or overwrite preview state

### Requirement: Multi-Repository Change Groups Match Single-Repository Density

Multi-repository repository groups MUST preserve the shared changed-file renderer and SHALL use the single-repository file-row density baseline.

#### Scenario: Repository header uses compact file-row dimensions

- **WHEN** multi-repository change groups are rendered
- **THEN** each repository header SHALL use the shared `26px` file-row minimum-height baseline and shared typography/padding tokens
- **AND** repository metadata SHALL remain truncated and readable within a narrow Git side panel

#### Scenario: Changed-file rows do not gain multi-repository scaling

- **WHEN** staged or unstaged files render inside a repository group
- **THEN** file and folder rows MUST keep the same shared renderer dimensions used by single-repository mode
- **AND** multi-repository CSS MUST NOT introduce larger row-specific font size, icon size, or vertical padding
