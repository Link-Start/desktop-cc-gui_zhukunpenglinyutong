## ADDED Requirements

### Requirement: File Editor Context Shortcuts MUST Preserve Existing Bindings And Use IDEA Conventions

File Editor MUST preserve all existing configurable and fixed shortcuts while adding missing context-scoped bindings using IntelliJ IDEA conventions or consistent product mnemonics.

#### Scenario: Existing bindings remain unchanged

- **WHEN** 用户在 File Editor 使用 Expand Selection、Definition、References 或 Save
- **THEN** `Cmd/Ctrl+W`、`Cmd/Ctrl+B`、`Alt+F7` 与 configured `Cmd/Ctrl+S` MUST 保持原行为
- **AND** 本变更 MUST NOT migrate、rewrite 或 clear persisted shortcut settings

#### Scenario: Implementation uses IDEA navigation binding

- **WHEN** focus 位于 CodeMirror 且用户在 macOS 按下 `Cmd+Alt+B`，或在 Windows/Linux 按下 `Ctrl+Alt+B`
- **THEN** editor MUST invoke the existing Go to Implementations action
- **AND** MUST reuse current candidate/direct-navigation behavior

#### Scenario: Fixed product actions remain file-view scoped

- **WHEN** 用户按下 Reveal、Preview/Edit、Canvas、Note、File History 或 Git Blame 的 fixed shortcut
- **THEN** action MUST execute only while the corresponding File Editor action is available
- **AND** unavailable、disabled 或 unrelated editable surfaces MUST NOT be consumed

### Requirement: File Shortcut Labels MUST Share Their Executable Definitions

Every shortcut hint rendered in the file content context menu MUST be derived from the same shortcut definition used by its keyboard behavior.

#### Scenario: Platform label matches executable binding

- **WHEN** file content context menu renders on macOS or Windows/Linux
- **THEN** each shortcut hint MUST use the shared platform formatter
- **AND** pressing the displayed combination MUST invoke the same action as selecting that menu item

#### Scenario: Configurable shortcut is cleared

- **WHEN** Save or Expand Selection shortcut setting is explicitly `null`
- **THEN** the corresponding menu action MAY remain available
- **AND** it MUST NOT display or register a shortcut that bypasses the cleared setting
