## ADDED Requirements

### Requirement: Codex live wait phase MUST surface subagent squad

在 Codex native（及 Shared 上 Codex execution）父会话 **实时对话** 中，当侧栏已存在 collab 子代理子会话、且 timeline 尚无可用 collab spawn 小队事实（典型为 wait 主导阶段）时，系统 MUST 在幕布呈现与子会话数量一致的 SubAgent persona 小队，而不是仅展示裸 `Collab: wait` 工具行。

#### Scenario: live wait with three child sessions

- **GIVEN** Codex 父会话 live turn 正在处理
- **AND** Sidebar 已显示 3 个 collab 子代理（如 Aristotle / Banach / Pascal）
- **AND** 父幕布 timeline 当前只有 `Collab: wait` / `wait_agent` 等 lifecycle 工具、无可展开的 spawn 卡
- **WHEN** 幕布渲染该父会话
- **THEN** 系统 MUST 渲染 3 张 SubAgent persona 卡（合成或等价源）
- **AND** 卡片展示名 MUST 优先使用子会话 nickname / agent identity
- **AND** wait 工具 MUST NOT 被渲染为 persona 卡

#### Scenario: live squad does not double after history spawn arrives

- **GIVEN** live 已通过子会话合成 3 张卡
- **WHEN** 随后 timeline 出现完整 `Collab: spawn_agent` 且带 `receiverThreadIds`
- **THEN** 小队 MUST 收敛为不超过 3 张卡（按 agentId / sessionThreadId 去重）
- **AND** MUST 优先保留真实 collab tool 派生卡

#### Scenario: history end state remains correct

- **WHEN** 同一 Codex collab 会话 turn 结束后按 history 路径重开
- **THEN** 幕布 MUST 继续呈现完整 SubAgent 小队
- **AND** MUST NOT 因本 live 修复引入双卡或密文 message 描述

### Requirement: Codex live Status Agents tab MUST use child-tree fallback

当 Codex 引擎 StatusPanel 从 collab tools 无法抽出任何 agent id（`receiverThreadIds` / `agentStatus` / fallback link 皆空），但当前根会话子树存在 collab 子会话时，系统 MUST 仍展示 Agents tab 与子代理列表。

#### Scenario: wait-only collab tools hide no agents tab

- **GIVEN** 父会话 live items 仅有 `Collab: wait` 且无 receiver ids
- **AND** `threadParentById` 或等价关系下存在 2+ 个子代理 thread
- **WHEN** StatusPanel 聚合 subagents
- **THEN** Agents（或 Subagents）tab MUST 可见
- **AND** 列表条目数 MUST 等于可识别子会话数（或与侧栏子代理一致）
- **AND** 点击条目 MUST 打开与幕布共享的 inspector 路径

#### Scenario: non-codex engines skip child-tree fallback

- **WHEN** `activeEngine` 为 claude / grok / kimi / gemini / opencode 且非 Codex collab 上下文
- **THEN** StatusPanel MUST NOT 仅因存在 child threads 启用本 Codex collab fallback
- **AND** 既有 task/agent/spawn_subagent 聚合路径 MUST 保持不变

### Requirement: Live collab receiver id extraction parity with history

Codex live 路径将 collab tool 投影为 `ConversationItem` 时，MUST 与 history `parseCodexSessionHistory` 对齐常见 id 字段（含 `targets` / `target` / `ids` / `id` 及既有 `receiverThreadIds`），以便 spawn 完成后能尽早展开真实 receiver。

#### Scenario: wait_agent targets populate receiverThreadIds

- **WHEN** live collab item 参数含 `targets: ["agent-a", "agent-b"]` 或等价字段
- **THEN** 投影后的 tool item MUST 暴露对应 `receiverThreadIds`
- **AND** StatusPanel collab 聚合 MUST 能据此列出 agent-a / agent-b

### Requirement: Engine isolation hard gate

本 capability 的合成小队与 Status child-tree fallback MUST 仅服务 Codex collab 缺口；MUST NOT 改变 Claude / Grok / Kimi 在实时或历史阶段的已验证行为。

#### Scenario: grok shared synthetic unchanged

- **GIVEN** Shared 父会话引擎为 Grok 且投影无 spawn tool、有 2 个子会话
- **WHEN** 幕布渲染
- **THEN** 仍 MUST 按既有 Shared synthetic 路径渲染小队
- **AND** MUST NOT 误用 Codex-only toolType 或破坏 Grok sessionThreadId 解析

#### Scenario: claude agent tools unchanged

- **WHEN** Claude 会话出现 `Agent` / `Task` tool
- **THEN** 识别与 persona 渲染 MUST 与变更前一致
- **AND** MUST NOT 因 Codex fallback 逻辑注入额外合成卡
