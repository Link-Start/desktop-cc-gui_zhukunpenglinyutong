## ADDED Requirements

### Requirement: Input history MUST have a single writer and a single source of truth

发送输入历史 MUST 只写入 `useInputHistoryStore`（`~/.ccgui/inputHistory.json` + localStorage 同步）；↑/↓ 导航、inline completion、设置页、搜索雷达 MUST 从同一存储读取。

#### Scenario: send writes history exactly once

- **WHEN** 用户从 composer 发送一条 prompt
- **THEN** 系统 MUST 只对 `useInputHistoryStore` 执行一次 `recordHistory`
- **AND** MUST NOT 写入 `composer.promptHistory` clientStorage
- **AND** MUST NOT 经 ChatInputBox localStorage 副本重复写入

#### Scenario: live consumers refresh on mutation

- **WHEN** 历史被 record / delete / clear / add / update 任一途径修改
- **THEN** `useInputHistoryStore` MUST 派发 `inputHistoryChanged` 事件
- **AND** ChatInputBox ↑/↓ 导航 MUST 在同会话内看到最新条目（无需重挂载）

### Requirement: Removed prompt-history implementations MUST NOT leave active writers

`usePromptHistory` hook 与 ChatInputBox `useInputHistory` 的 localStorage 直写实现 MUST 被移除，不得残留活跃写入路径。

#### Scenario: no code path writes composer.promptHistory

- **WHEN** 检查 `src/` 全部存活代码
- **THEN** MUST NOT 存在对 `usePromptHistory` 的 import
- **AND** MUST NOT 存在对 clientStorage `promptHistory` key 的运行时写入
