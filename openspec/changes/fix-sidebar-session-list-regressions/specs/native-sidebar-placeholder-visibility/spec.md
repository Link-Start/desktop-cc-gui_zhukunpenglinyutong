## ADDED Requirements

### Requirement: Sidebar Top-Level MUST Be One Visible Conversation

侧栏顶层 MUST 一对一：一个对话一条顶层行。pending 草稿、弱标题占位（`{engine} session` / `{Engine} Session` / `DeepSeek Harness Session` / `Agent N` / `Warmup` / 短 hex）MUST 隐藏。

**例外**：当前 active 会话即使标题仍弱，MUST 保持一条顶层可见，便于用户找到正在看的对话。切走之后若仍是弱标题且无自定义名，MUST 隐藏。

自定义标题 MUST 可见。`parentThreadId` 非空的子会话 MUST 仍挂在父会话下，MUST NOT 因本规则升为顶层，也 MUST NOT 被本规则从父下摘掉。

pending `{engine}-pending-{millis}-{nonce}` MUST NOT 写入可见 Index 行。pending→real remap MUST tombstone 旧 pending id，同一对话 MUST NOT 同时出现 pending 与 real 两条顶层。

#### Scenario: current conversation stays visible while drafts hide

- **GIVEN** 用户新开一条 Claude 会话，内存标题仍是弱标题
- **AND** 该会话是当前 active
- **WHEN** 侧栏投影
- **THEN** 该会话 MUST 作为一条顶层可见
- **AND** 同时存在的 pending 草稿 / 其它 `{engine} session` / `Agent N` MUST NOT 再占顶层

#### Scenario: switching away hides leftover placeholder

- **GIVEN** 一条非 active 的 native 行标题为 `codex session` 或 `Agent 3`，且无自定义名
- **WHEN** 侧栏投影
- **THEN** 该行 MUST NOT 出现在顶层

#### Scenario: pending remap does not leave two top-level rows

- **GIVEN** 客户端曾创建 `grok-pending-{millis}-{nonce}`
- **WHEN** runtime 暴露 canonical id 并 remap
- **THEN** pending Index 行 MUST 被 tombstone
- **AND** 侧栏顶层 MUST 只保留 remap 后的那一条（若它是 active 或已有强标题）

#### Scenario: child sessions stay mounted under parent

- **GIVEN** 一条 native 子会话 `parentThreadId` 指向父会话
- **WHEN** 侧栏投影
- **THEN** 该子会话 MUST 仍挂在父会话下
- **AND** MUST NOT 被提升为顶层根
