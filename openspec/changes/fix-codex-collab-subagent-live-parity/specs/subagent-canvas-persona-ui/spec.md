## MODIFIED Requirements

### Requirement: Synthetic squad from shared child sessions

当父幕布无可用 subAgent tool 事实但存在子代理子会话时，系统 MUST 在 **Shared 父会话** 以及 **Codex collab live 缺口（native 或 Shared-on-Codex）** 下用子会话合成小队卡；嵌套详情幕布 MUST NOT 再次注入合成卡。Claude / Grok / Kimi 的非缺口路径 MUST NOT 被扩大注入。

#### Scenario: shared parent without spawn tools

- **WHEN** Shared 父会话投影只有 assistant 正文且存在 3 个子代理子会话
- **THEN** 幕布 MUST 渲染 3 张 persona 卡
- **AND** 打开某卡详情时，详情内 MUST NOT 嵌套同一小队

#### Scenario: codex native live wait without spawn tools

- **GIVEN** native Codex 父会话 live timeline 无可展开 collab spawn 卡（仅 wait 或空工具段）
- **AND** 存在 3 个 `parentThreadId` 指向该父会话的子代理
- **WHEN** 幕布渲染该父会话
- **THEN** 系统 MUST 渲染 3 张 persona 卡
- **AND** wait lifecycle 工具 MUST NOT 计入 persona 卡

#### Scenario: non-codex native parent does not inject child synthetic

- **WHEN** native Claude / Grok / Kimi 父会话 timeline 无 subAgent tool 但因其他原因存在 child threads
- **THEN** 系统 MUST NOT 因本 Codex live 修复而注入合成小队
- **AND** 既有引擎自有 tool 识别路径 MUST 保持不变

#### Scenario: nested detail canvas never re-injects

- **WHEN** 用户从父小队打开子代理详情幕布（threadId 为 child）
- **THEN** 详情幕布 MUST NOT 再次注入父级合成小队

## ADDED Requirements

### Requirement: Wait lifecycle tools stay non-persona across live and history

系统 MUST 继续将 Codex `Collab: wait` / `wait_agent` / `close_agent` 识别为 lifecycle 工具；live 与 history MUST NOT 将其渲染为 persona 卡。子代理呈现 MUST 来自 spawn 工具、子会话合成，或其他引擎既有 spawn 源。

#### Scenario: consecutive waits do not form a squad

- **WHEN** 幕布连续出现多条 `Collab: wait` 且无 spawn
- **THEN** 系统 MUST NOT 将 wait 合并为 subagentGroup persona 小队
- **AND** 若满足 Codex child synthetic 条件，小队 MUST 来自子会话合成而非 wait 工具本身
