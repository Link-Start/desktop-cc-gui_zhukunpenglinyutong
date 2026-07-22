## ADDED Requirements

### Requirement: File Editor Expand Selection Shortcut MUST Be Configurable And Editor Scoped

Application SHALL expose a stable configurable shortcut action for expanding the CodeMirror selection to its parent syntax node, and the action MUST remain editor scoped.

#### Scenario: Default shortcut expands syntax selection
- **WHEN** focus 位于 file CodeMirror editor 且用户按下默认 `ctrl+w`
- **THEN** editor MUST invoke CodeMirror parent-syntax selection
- **AND** repeated activation MUST expand selection through available syntax parents

#### Scenario: Shortcut appears in settings
- **WHEN** 用户打开 Settings -> Basic -> Shortcuts
- **THEN** expand-selection action MUST 出现在 editor group
- **AND** 用户 MUST 能修改或清空该 shortcut

#### Scenario: Cleared shortcut is disabled
- **WHEN** persisted expand-selection shortcut 为 `null`
- **THEN** editor MUST NOT 注册该 custom binding
- **AND** unrelated editor and application shortcuts MUST remain unchanged

### Requirement: Expand Selection Shortcut MUST Respect Platform And Editable Boundaries

Expand-selection shortcut SHALL 使用 shared shortcut parsing/formatting semantics，并 MUST NOT 作为 global window shortcut 劫持普通 editable targets。

#### Scenario: Ctrl+W is pressed outside CodeMirror
- **WHEN** focus 位于普通 input、textarea、select 或 contenteditable surface
- **THEN** expand-selection action MUST NOT consume the event

#### Scenario: macOS close-session shortcut remains distinct
- **WHEN** macOS 用户按 `Cmd+W`
- **THEN** existing close-current-session shortcut behavior MUST remain available
- **AND** expand-selection default MUST NOT replace `Cmd+W`

#### Scenario: Persisted shortcut round-trips through desktop settings
- **WHEN** 用户保存 custom 或 explicit `null` expand-selection shortcut
- **THEN** Rust settings deserialize/save/serialize round-trip MUST preserve the same value
- **AND** existing shortcut customizations MUST remain unchanged
