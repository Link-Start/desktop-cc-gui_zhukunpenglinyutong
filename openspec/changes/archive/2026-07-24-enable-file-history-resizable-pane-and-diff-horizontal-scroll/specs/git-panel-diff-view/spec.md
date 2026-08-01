# Delta: git-panel-diff-view

## ADDED Requirements

### Requirement: Center preview toolbar and aligned body MUST converge without capability loss

Git 面板“在中间区域预览”MUST 保留既有 diff toolbar controls；当用户选择 split text
diff 时，body MUST 复用 File History 的 `WorkspaceReadOnlyDiffCompare` aligned
CodeMirror renderer。

#### Scenario: split text preview reuses the shared aligned compare

- **WHEN** 用户在 Git changed-file row 触发“在中间区域预览”
- **AND** 当前 entry 是 text diff 且 view style 为 `split`
- **THEN** toolbar MUST 继续显示双栏/单栏与全文/区域 controls
- **AND** body MUST 显示 shared previous/source CodeMirror columns
- **AND** difference navigation、gutter labels、semantic red/green tone 与 horizontal scroll MUST 保持可用

#### Scenario: toolbar mode changes still control the body

- **WHEN** 用户从 split 切换到 unified
- **THEN** body MUST 回到既有 unified patch renderer
- **WHEN** 用户在 full/focused content mode 间切换
- **THEN** toolbar 与 aligned body MUST 消费同一受控 mode，不得显示不同版本的 diff

#### Scenario: non-text and specialized surfaces retain their renderer

- **WHEN** entry 是 image、binary、PR review 或 editable modal preview
- **THEN** existing `GitDiffViewer` / editable renderer MUST remain in use
- **AND** renderer convergence MUST NOT remove annotation、editing、image compare 或 close behavior
