## ADDED Requirements

### Requirement: File tab context menu MUST target the invoked tab

系统 SHALL 为文件 tab 提供目标感知的 context menu，并确保所有动作作用于触发右键的 tab，而不是隐式作用于当前 active tab。

#### Scenario: background tab remains the action target
- **GIVEN** file A is active and file B is also open
- **WHEN** 用户在 file B 上打开 context menu 并选择 `关闭当前`
- **THEN** 系统 MUST 关闭 file B
- **AND** file A MUST 保持 active

#### Scenario: open target tab in detached window
- **GIVEN** 用户在任一已打开 file tab 上打开 context menu
- **WHEN** 用户选择 `在新窗口打开标签`
- **THEN** 系统 MUST 复用 detached file explorer 创建链路打开该目标 path
- **AND** MUST NOT substitute the current active tab path

### Requirement: File tab context menu MUST provide atomic close actions

系统 SHALL 提供 `关闭当前`、`关闭其他` 与 `全部关闭`，并由拥有 tab state 的 controller 原子更新当前 workspace 或 detached session。

#### Scenario: close other tabs keeps and activates the target
- **GIVEN** 当前 session 打开 file A、file B 与 file C
- **WHEN** 用户在 file B 的 context menu 选择 `关闭其他`
- **THEN** open tabs MUST become exactly `[file B]`
- **AND** file B MUST become active

#### Scenario: close other is disabled for a single tab
- **GIVEN** 当前 session 仅打开一个 file tab
- **WHEN** 用户打开该 tab 的 context menu
- **THEN** `关闭其他` MUST be disabled
- **AND** selecting it MUST NOT mutate tab state

#### Scenario: close all remains workspace scoped
- **GIVEN** main window workspace A、workspace B 与 detached explorer 各有 open tabs
- **WHEN** 用户在 workspace A 的 tab context menu 选择 `全部关闭`
- **THEN** only workspace A tab state MUST be cleared
- **AND** workspace B and detached explorer tab state MUST remain unchanged

### Requirement: File tab context menu MUST expose read-only Git actions

系统 SHALL 在 `Git 操作` submenu 中仅提供 `显示文件历史` 与 `Git Blame`，并根据目标文件的 Git scope 与 surface capability 控制可用状态。

#### Scenario: file history uses target repository scope
- **GIVEN** 目标 tab belongs to a resolved Git repository and file history callback is available
- **WHEN** 用户选择 `显示文件历史`
- **THEN** 系统 MUST pass the target workspace、repository root、repository-relative path and display path to the existing file history flow

#### Scenario: Git Blame activates a background target first
- **GIVEN** 用户在非 active text file tab 上打开 context menu
- **WHEN** 用户选择 `Git Blame`
- **THEN** 系统 MUST activate that target tab before enabling blame
- **AND** blame MUST NOT load for the previously active file

#### Scenario: unavailable Git action cannot execute
- **GIVEN** 目标 file lacks a valid Git scope or the current surface cannot open file history
- **WHEN** context menu renders
- **THEN** the unavailable action MUST be disabled or omitted
- **AND** no Git request MUST be issued for that action

### Requirement: File tab context menu MUST follow shared visual and accessibility contracts

菜单 SHALL 复用 shared renderer context menu 的 portal、viewport、dismiss 与 keyboard contract，并为可操作 menu item 提供左侧 icon。

#### Scenario: menu remains inside viewport
- **WHEN** 用户在 viewport 右侧或底部附近打开 file tab context menu
- **THEN** menu position MUST be clamped inside the visible viewport

#### Scenario: menu supports dismissal and focus feedback
- **WHEN** menu is open and the user presses Escape、clicks outside、or the window loses focus
- **THEN** menu MUST close
- **AND** hover/focus state MUST use theme tokens in light and dark themes

#### Scenario: actions expose decorative icons without changing labels
- **WHEN** file tab context menu renders
- **THEN** each actionable root item MUST render a left icon marked decorative
- **AND** accessible menuitem names MUST continue to come from localized labels
