## MODIFIED Requirements

### Requirement: File content context menu MUST consolidate editor commands

系统 SHALL 在文件内容区提供与 file tab context menu 同视觉契约的单一 context menu，并将 note capture、clipboard commands、read-only Git actions 与原 file toolbar commands 收敛到该入口。

#### Scenario: edit surface exposes capture, clipboard and file commands

- **GIVEN** active file is editable and rendered in edit mode
- **WHEN** 用户在 CodeMirror 内容区打开 context menu
- **THEN** exactly one renderer context menu MUST open
- **AND** menu MUST include available note capture、`剪切`、`复制`、`粘贴`
- **AND** menu MUST expose available Intent Canvas、definition、references、preview and save commands
- **AND** `显示文件历史` 与 Git Blame MUST be grouped under `Git 操作`

#### Scenario: preview surface keeps safe command boundaries

- **GIVEN** active file is rendered in preview or read-only mode
- **WHEN** 用户打开 file content context menu
- **THEN** Copy MUST be available only when text is selected
- **AND** Cut and Paste MUST be disabled
- **AND** available note capture and read-only File History MAY remain available
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

## ADDED Requirements

### Requirement: File content note capture MUST prefer canonical selection and fall back to the complete file

系统 SHALL 在同一 file content context menu 内生成 source-aware `NoteCaptureDraft`；canonical code selection 优先，无 selection 时使用当前完整文本文件，并继续由 note workbench 确认保存。

#### Scenario: edit selection capture preserves current range

- **GIVEN** CodeMirror has a non-empty canonical selection
- **WHEN** 用户打开 file content context menu 并选择保存到便签
- **THEN** draft MUST contain exactly the selected document text and source line range
- **AND** no second note-only popover MUST render

#### Scenario: edit without selection captures the current whole document

- **GIVEN** CodeMirror has no non-empty selection and the loaded text document is not truncated or blank
- **WHEN** 用户选择保存到便签
- **THEN** draft MUST contain the current complete CodeMirror document from line 1 through its final line
- **AND** unsaved editor changes MUST be included

#### Scenario: preview selection and whole-source fallback remain source-aware

- **GIVEN** a code preview has a logical line selection
- **WHEN** 用户选择保存到便签
- **THEN** draft MUST contain that frozen logical line range
- **WHEN** the same preview has no logical line selection
- **THEN** draft MUST contain the complete loaded source

#### Scenario: incomplete or unsupported content is not captured as a whole file

- **GIVEN** the file is truncated、blank or has no canonical text source
- **WHEN** file content context menu renders without a valid selection draft
- **THEN** system MUST NOT offer an action that labels partial or unavailable content as the complete file

### Requirement: File content Git actions MUST use one repository-scoped submenu

系统 SHALL 为 active file content menu 复用 `Git 操作` submenu，并 SHALL 以 owning repository scope 执行 `显示文件历史` 与 Git Blame。

#### Scenario: nested repository history targets the active file

- **GIVEN** active file belongs to a nested known Git repository and File History navigation is available
- **WHEN** 用户选择 `Git 操作 -> 显示文件历史`
- **THEN** callback MUST receive the owning repository root、repository-relative path and active display path

#### Scenario: Git submenu exposes only available read-only actions

- **WHEN** active file has no valid Git scope or a host capability is absent
- **THEN** the corresponding Git leaf MUST be omitted or disabled
- **AND** no Git mutation action MUST be introduced
