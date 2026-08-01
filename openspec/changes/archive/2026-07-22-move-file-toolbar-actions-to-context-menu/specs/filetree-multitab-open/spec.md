## ADDED Requirements

### Requirement: File content context menu MUST consolidate editor commands

系统 SHALL 在文件内容区提供与 file tab context menu 同视觉契约的 context menu，并将 clipboard commands 与原 file toolbar commands 收敛到该入口。

#### Scenario: edit surface exposes clipboard and file commands
- **GIVEN** active file is editable and rendered in edit mode
- **WHEN** 用户在 CodeMirror 内容区打开 context menu
- **THEN** menu MUST include `剪切`、`复制`、`粘贴`
- **AND** menu MUST expose available Git Blame、Intent Canvas、definition、references、preview and save commands

#### Scenario: preview surface keeps safe command boundaries
- **GIVEN** active file is rendered in preview or read-only mode
- **WHEN** 用户打开 file content context menu
- **THEN** Copy MUST be available only when text is selected
- **AND** Cut and Paste MUST be disabled
- **AND** unavailable editor-only commands MUST NOT execute

#### Scenario: clipboard failure preserves editor content
- **GIVEN** Clipboard API is unavailable or rejects access
- **WHEN** 用户选择 Cut、Copy or Paste
- **THEN** system MUST surface an explicit error
- **AND** failed Cut MUST NOT delete the selected editor content

#### Scenario: independent editable controls retain native menu
- **GIVEN** file view contains an annotation input、textarea or non-CodeMirror contenteditable control
- **WHEN** 用户在该 control 上打开 context menu
- **THEN** system MUST NOT replace its native context menu with the file content menu

### Requirement: File view header MUST keep navigation and tabs on one row

系统 SHALL 将 file back/leading action 放在 Tab 行最左侧，并 SHALL NOT render the legacy path/action toolbar below the Tab row。

#### Scenario: main file view uses one header row
- **WHEN** main window renders an active file with one or more tabs
- **THEN** back action MUST appear before the tab list in the same row
- **AND** the legacy `.fvp-topbar` MUST NOT be rendered

#### Scenario: detached file view preserves leading action compatibility
- **WHEN** detached file explorer renders its file header
- **THEN** configured leading direction、label and callback MUST remain effective
- **AND** file commands MUST remain available through the file content context menu instead of a persistent toolbar

### Requirement: File content context menu MUST reuse shared menu behavior

文件内容菜单 SHALL 复用 `RendererContextMenu` 的 portal、viewport clamp、dismiss、keyboard、icon 与 theme contract，不得复制平行 menu implementation。

#### Scenario: content menu follows tab menu visual contract
- **WHEN** file content context menu renders
- **THEN** root menu and actionable items MUST use the same scoped radius、spacing and theme-token treatment as the file tab context menu
- **AND** accessible menuitem names MUST come from localized labels

#### Scenario: content menu remains inside viewport
- **WHEN** 用户在 viewport 右侧或底部附近打开 file content context menu
- **THEN** menu position MUST be clamped inside the visible viewport
- **AND** Escape、outside click or window blur MUST close it
