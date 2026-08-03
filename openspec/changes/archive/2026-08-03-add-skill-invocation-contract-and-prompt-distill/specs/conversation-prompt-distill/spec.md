## ADDED Requirements

### Requirement: conversation context menu MUST offer save-as-prompt

对话上下文菜单 MUST 提供"存为 Prompt"入口（selection 与整 thread 两种粒度）。

#### Scenario: selection save-as-prompt entry

- **WHEN** 用户在对话区域选中一段文本并打开上下文菜单
- **THEN** 菜单 MUST 包含"存为 Prompt"项
- **AND** 选择后 MUST 以选中文本为源启动提炼

#### Scenario: whole-thread save-as-prompt entry

- **WHEN** 对话存在可提炼内容且用户打开上下文菜单
- **THEN** 菜单 MUST 包含以整 thread 为源的"存为 Prompt"项

### Requirement: distillation MUST use hidden read-only session

提炼 MUST 经隐藏 session 调用引擎（不打断当前对话），失败 MUST 本地化展示。

#### Scenario: distill produces editable preview

- **WHEN** 提炼成功
- **THEN** 对话框 MUST 展示可编辑的名称与内容，内容保留 `$ARGUMENTS` 参数位
- **AND** 提炼过程 MUST 使用 `sessionPurpose: "prompt-distill"`、`accessMode: "read-only"` 的隐藏 session

#### Scenario: retryable failure falls back to codex

- **WHEN** claude 提炼以 retryable 错误失败
- **THEN** 系统 MUST 自动以 codex 重试一次
- **AND** 双失败时 MUST 展示本地化错误文案

### Requirement: saved prompt MUST land in managed commands dir

保存 MUST 写入 workspace managed commands 目录并立即可被列出。

#### Scenario: save creates discoverable command

- **WHEN** 用户确认保存合法名称与内容
- **THEN** Rust MUST 在 managed 目录创建 `<name>.md`
- **AND** `claude_commands_list` MUST 能立即列出该命令（source = workspace_managed）

#### Scenario: duplicate or invalid name rejected

- **WHEN** 名称已存在或含非法字符
- **THEN** Rust MUST 拒绝并返回错误，MUST NOT 静默覆盖
