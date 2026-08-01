## MODIFIED Requirements

### Requirement: File Editor Expand Selection Shortcut MUST Be Configurable And Editor Scoped

Application SHALL expose a stable configurable shortcut action for expanding the CodeMirror selection to its parent syntax node, and the action MUST remain editor scoped.

#### Scenario: Default shortcut expands syntax selection
- **WHEN** focus 位于 file CodeMirror editor 且用户在 macOS 按下默认 `Cmd+W`，或在 Windows/Linux 按下默认 `Ctrl+W`
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

#### Scenario: Platform-primary W is pressed outside CodeMirror
- **WHEN** focus 位于普通 input、textarea、select 或 contenteditable surface
- **THEN** expand-selection action MUST NOT consume the event

#### Scenario: Editor-scoped expand selection takes precedence
- **WHEN** focus 位于 file CodeMirror editor
- **AND** 用户按下 platform-primary `Cmd/Ctrl+W`
- **THEN** expand-selection action MUST consume the event before close-current-session handling
- **AND** native window menu MUST NOT close the application window

#### Scenario: Close current session remains available outside the editor
- **WHEN** focus 不在 file CodeMirror editor
- **AND** 用户按下 configured close-current-session shortcut
- **THEN** existing close-current-session behavior MUST remain available

#### Scenario: Persisted shortcut round-trips through desktop settings
- **WHEN** 用户保存 custom 或 explicit `null` expand-selection shortcut
- **THEN** Rust settings deserialize/save/serialize round-trip MUST preserve the same value
- **AND** existing shortcut customizations MUST remain unchanged

#### Scenario: Previous unreleased default remains usable during transition
- **WHEN** persisted expand-selection shortcut 仍为上一版默认 `ctrl+w`
- **THEN** editor MUST additionally accept platform-primary `Cmd/Ctrl+W`
- **AND** 用户改成其他 custom shortcut 或清空后 MUST NOT 注册该 compatibility binding

## ADDED Requirements

### Requirement: Native Close Window Menu MUST Not Reserve Expand Selection Shortcut

Desktop native File/Window menus SHALL keep a clickable close-window command but MUST NOT register a `Cmd/Ctrl+W` accelerator that preempts editor-scoped shortcuts.

#### Scenario: User clicks Close Window menu item
- **WHEN** 用户点击 native File 或 Window menu 的 Close Window item
- **THEN** 当前目标窗口 MUST close through the existing menu handler

#### Scenario: User presses platform-primary W inside file editor
- **WHEN** file editor 已获得 focus 且用户按下 platform-primary `Cmd/Ctrl+W`
- **THEN** native menu MUST NOT intercept the key event
- **AND** CodeMirror MUST receive the event for expand-selection handling
