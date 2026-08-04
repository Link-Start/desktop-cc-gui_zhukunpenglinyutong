## Why

Shared 会话绑定 Claude Code 时，用户确认：多工具回合 **流式中时间线顺序正常**，但 **本轮结束后偶发**「助手结论文本出现在工具卡前面」；关对话再开历史则顺序恢复。该分叉说明 **live settlement 后的内存 items 与 history loader 投影不一致**，且问题落在 Shared/Native **共用** 的 live-text 外置、agent segment 分段与 `onTurnCompleted` 链路上，不限于单一 UI 树。若不专业修复，多 CLI 长工具回合会持续出现「重开才正常」的信任损伤，并与既有 `conversation-realtime-history-parity` 合同冲突。

分析底稿：`docs/analysis/live-settle-assistant-tool-order-2026-08-04.md`。

## What Changes

- 为 assistant 流式分段建立 **settlement-safe 身份绑定**：`appendAgentDelta` / `completeAgentMessage` / live-text drain 在解析目标 item 时，不得在 `resetAgentSegment` 之后把本 turn 终稿误挂到 seg0 裸 `itemId`（工具前气泡）。
- 收紧 **tool 边界与 turn terminal** 的 live-text 契约：分段前 drain、终稿 clear、turn complete drain 的顺序与 itemId 选择可测、可审计；禁止「流式对、settle 后错」的相位空洞。
- 固化 **assistant ↔ tool 交错顺序不变式**：同一 user turn 内，工具后产生的结论段 MUST 仍排在相关 tool 项之后；history hydrate 与 live settle 后可见序 MUST 一致。
- 覆盖 **Shared + Native** 共用路径；Shared alias 双 thread settle 不得放大错误挂载。
- 补齐 Vitest 相位回归（文 → tool → 文 → turn completed / late complete）与可选 diagnostics（无用户正文落盘）。
- **不**改 history loader 作为主修复；**不**引入整轮文本重排启发式。

## 目标与边界

- **目标**
  1. 消除「流式正确 → 本轮结束后结论跑到工具前」的 live/history 分叉（含偶发 race）。
  2. 跨引擎共用路径一次修好：Claude / Codex / Kimi / OpenCode / Grok 凡走同一 segment + live-text + turn settle 的路径均受益。
  3. Shared 与 Native 行为一致；Shared alias settle 不得单独引入错序。
  4. 用可重复单测锁住 settle 相位；手测矩阵以 Claude Shared/Native 为 P0。
- **边界**
  - 仅前端 thread realtime / reducer / live-text / turn settlement 与相关测试、契约。
  - 行为变更以 OpenSpec delta 为准；分析文档可回链更新状态。

## 非目标

- 不重写统一幕布渲染核、不改 virtualization / scroll ownership。
- 不改 Claude/Codex 等 provider 协议，不改 Grok jsonl 桥的「工具滞后可见性」（那是另一类问题）。
- 不把「重开历史」当产品修复；不依赖 history reconcile 做顺序纠错主路径。
- 不合并/折叠用户有意区分的多段 assistant 正文（工具分隔的多段必须保留）。
- 不恢复逐 delta 进根 reducer（`liveTextExternalization` 默认开保持）。
- 不在本 change 做 Gemini runtime 启用。

## 技术方案对比

| 方案 | 描述 | 优点 | 风险 | 结论 |
|------|------|------|------|------|
| A. 仅文档 + 用户「重开会话」 | 不改代码 | 零风险 | 信任与 parity 合同持续破损 | **否决** |
| B. History settle 后全量 reload 纠序 | 结束后强制 loader 重投影 | 实现省事 | 闪烁、丢 live 态、掩盖根因、perf 差 | **否决为主路径** |
| C. 按时间戳全局重排 items | settle 时 sort | 看似通用 | 破坏稳定 id/插入序、难测、易伤别的投影 | **否决** |
| **D. Segment 快照绑定 + settle 顺序契约（推荐）** | complete/drain 绑定创建时 segment 或通道 item 身份；`resetAgentSegment` 与 late complete 解耦；补相位测试 | 对准 race；Shared/Native 同源；可测；不破坏 live-text perf | 需仔细处理 legacy id / Codex dedupe | **采用** |

## Capabilities

### New Capabilities

- `live-assistant-segment-settlement`: live-text 外置下，assistant 多段（tool 交错）在 **流式、tool 边界、agent completed、turn completed** 全相位的 item 身份、drain/clear 顺序与 **可见时间线顺序不变式**；Shared alias 与 Native 共用。

### Modified Capabilities

- `conversation-realtime-history-parity`: 补充「live settle 后」与 history hydrate 对 **assistant/tool 交错序** 的 parity（不仅 cardinality / 去重）。
- `conversation-render-surface-stability`: 补充 live-text 在 turn terminal 与 segment reset 时的安全收敛，禁止终稿误挂早期 segment。

## Impact

| 层 | 影响面 |
|----|--------|
| Frontend core | `liveAssistantTextChannel.ts`、`useThreadItemEvents.ts`、`useThreadTurnEvents.ts`、`useThreadsReducer.ts` / `applyCompleteAgentMessageToState`、`threadReducerCoreHelpers.ts`（`resolveLiveAssistantMessageId`）、可能的 Shared alias settle 调用点 |
| Tests | `useThreadItemEvents.liveTextSegment.test.ts` 扩展；新增 settle 相位 / late complete after reset 用例；必要时 Codex tool-separated 段 + complete 回归 |
| Specs | 新 capability + 两条 main spec delta |
| Docs | 分析文状态可标「OpenSpec change 进行中」；不强制大段产品文案 |
| Perf | **禁止**恢复 per-delta 根 reducer；不得新增根链秒级轮询 |

## 验收标准

1. **P0 复现形态**（多 Read/Search/MCP + 长结论）：Shared×Claude 与 Native×Claude 在 **本轮结束后不关会话** 时，结论段仍在相关 tool 之后；关开历史序不变。
2. **Race**：模拟 `resetAgentSegment` 之后迟到的 `completeAgentMessage` / drain `appendAgentDelta`，终稿 **不得** 写入本 turn 工具前的 seg0 裸 id 气泡。
3. **流式中** 既有交错顺序保持；tool 边界 drain 早于 `incrementAgentSegment` 的既有回归仍绿。
4. **Shared alias**：双 thread settle 后两侧可见序均正确，或仅可见 curtain 正确且无把终稿并进错误早期 item。
5. **跨引擎**：Codex/Kimi/OpenCode 至少有共用路径单测覆盖；Grok 不因本修改变差（桥滞后另册）。
6. `liveTextExternalization` 默认开；typecheck + 相关 Vitest 通过；`openspec validate` 对本 change strict 通过。
7. 不引入 **BREAKING** 对外 API；无磁盘 schema 变更。

## 风险与回滚

| 风险 | 缓解 |
|------|------|
| 改 segment 解析导致重复 assistant 气泡 | 单测覆盖同 item 多 complete；保留 Codex tool-separated 非等价段 |
| clear/drain 顺序调整丢尾字 | drain-before-clear / drain-before-reset 成对测试 |
| Shared 只修一侧 | alias 双 target 用例 |

回滚：revert 本 change 前端提交即可；无迁移。
