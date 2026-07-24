## ADDED Requirements

### Requirement: File editor exposes line and column navigation

系统 MUST 在已打开的文本文件编辑器中提供 editor-scoped 行列跳转能力，并采用 1-based `line:column` 用户语义。

#### Scenario: Primary modifier shortcut opens the dialog

- **WHEN** 用户焦点位于文件编辑器并在 macOS 按下 `Cmd+G`，或在 Windows/Linux 按下 `Ctrl+G`
- **THEN** 系统 MUST 打开居中的行列跳转 modal
- **AND** 输入框 MUST 默认展示当前光标的行列并获得焦点

#### Scenario: Line-only input navigates to line start

- **WHEN** 用户输入有效的 `行号` 并确认
- **THEN** 系统 MUST 将光标定位到目标行第 1 列
- **AND** MUST 将目标位置滚动到视口中央

#### Scenario: Line and column input navigates precisely

- **WHEN** 用户输入有效的 `行号:列号` 并确认
- **THEN** 系统 MUST 按 1-based 行列语义定位光标
- **AND** 超出当前文档的行或列 MUST 安全收敛到最近有效位置

### Requirement: Line navigation dialog is safe and keyboard accessible

行列跳转 modal MUST 提供明确的确认、取消、校验与 accessibility contract，且不得干扰现有 editor shortcuts。

#### Scenario: Invalid input does not move the cursor

- **WHEN** 输入为空、包含非数字位置格式、行号小于 1 或列号小于 1
- **THEN** 系统 MUST 保持 modal 打开并展示 localized validation feedback
- **AND** MUST NOT 移动编辑器光标

#### Scenario: Keyboard confirmation and cancellation

- **WHEN** modal 打开且用户按下 `Enter`
- **THEN** 系统 MUST 执行与确认按钮相同的校验和跳转
- **WHEN** 用户按下 `Escape` 或激活取消按钮
- **THEN** 系统 MUST 关闭 modal 且不移动光标

#### Scenario: Existing editor shortcuts remain available

- **WHEN** 行列跳转能力启用
- **THEN** 现有 save、find、definition 与 references shortcuts MUST 保持原行为
- **AND** `Mod+G` MUST 仅在文本文件 editor surface 中生效

### Requirement: Line navigation dialog uses compact semantic presentation

行列跳转 modal MUST 使用适合 desktop editor 的紧凑空间密度，并提供可识别的行列语义 icon，同时保留 theme、responsive 与 accessibility 兼容性。

#### Scenario: Compact dialog preserves accessible interaction

- **WHEN** modal 在常规 desktop editor surface 中打开
- **THEN** 标题、输入框与操作区 MUST 采用紧凑间距和尺寸
- **AND** 标题 MUST 包含 decorative 行列语义 icon
- **AND** icon MUST 对 assistive technology 隐藏，dialog title 与 input label MUST 仍可被读取
