## Context

### 现状分层

| 路径 | 侧栏 | 幕布 SubAgent 小队 | Status Agents |
|------|------|-------------------|---------------|
| Codex live | ✅ `subAgentActivity` / `thread/started` | ❌ wait 阶段常无 spawn 卡 | ❌ 常缺 id → tab 隐藏 |
| Codex history | ✅ | ✅ `parseCodexSessionHistory` 重建 collab | ✅ |
| Claude / Grok / Kimi live+history | ✅ 已稳 | ✅ 已稳 | ✅ 已稳 |

### 根因（live-only）

1. **History** 用 `function_call`+`output` 重建完整 `collabToolCall`（含 `receiverThreadIds` / `agentStatus`）。
2. **Live** 侧栏已消费 `subAgentActivity`；幕布仍依赖 timeline 上的 collab **spawn** 工具。`wait`/`close` 被 `isSubagentTool` 故意排除。
3. Shared 子会话合成小队（`buildSyntheticSpawnToolsFromChildren`）仅在 `threadId.startsWith("shared:")` 时注入；**native Codex live 不注入**。
4. StatusPanel collab 路径在 `agentIds.length === 0` 时丢弃事实，**不回退** `childSubagentThreads` / `threadParentById`。

### 约束

- 其他 CLI 实时与历史均稳定 → 一切入口 MUST engine-gate 或仅在 Codex collab 缺口条件触发。
- 不把 wait 变成 persona 卡（现有单测与 capability 契约）。
- PlanFirst / OpenSpec：本 design 是实现前契约。

## Goals / Non-Goals

### Goals

- Live wait 主导阶段：幕布与 Status 与侧栏子代理事实一致。
- History 结束态不回归（无双卡、无密文、昵称可来自 child）。
- 改动面可证明「不触发」Claude/Grok/Kimi 路径。

### Non-Goals

- 改 collab 协议或 daemon 发射形状。
- 统一所有引擎 synthetic 策略。
- 改 wait 行的默认扁条工具 UI（可后续折叠优化，非本 change 必做）。

## Decisions

### Decision 1: 子会话树兜底为 live 主路径（Codex-gated）

**选择**：当父幕布判定为 **Codex collab 缺口** 时注入 synthetic tools（或等价 cards 源），条件：

```
needSynthetic =
  childSubagentThreads.length > 0
  AND timeline 中无「可展开的 collab spawn 卡」
     （!hasSubagentTools 或仅有 lifecycle collab 且无 receiver 展开结果）
  AND engine 为 codex
     （native: 非 shared: 且 activeEngine/codex thread；
      shared: parent 的 native owner 含 codex 或 child ids 为裸 codex uuid）
```

**实现落点**：`useMessagesPresentationState.timelineItemsForGrouping`。

- 放宽 `shared:` only 限制时 MUST 用 `isCodexCollabSyntheticEligible(...)` 包装，**禁止**裸 `children.length > 0` 对所有引擎生效。
- Claude/Grok 已有真实 tool 或既有 Shared Grok synthetic 时：`hasSubagentTools === true` → 不注入。

**备选**：只修 live collab 字段 → wait 阶段仍无 spawn 行。

### Decision 2: Status Agents 与幕布同源 fallback

**选择**：`useStatusPanelData` 在 Codex 且 collab 聚合后 `subagents` 仍空、但存在 parent 下 child threads 时，从 `threadParentById` + `threadStatusById` + `itemsByThread` 种子化 `SubagentInfo`。

- Gate：`isCodexEngine === true` 或 `activeEngine === "codex"`。
- 禁止在 Claude 会话因子 fork 误显 Agents 列表（Claude 用 task/agent tool 路径，不走此 fallback）。

**备选**：只修幕布 → 右侧仍缺面板（用户原截图痛点）。

### Decision 3: 保持 wait 非 persona；合成卡承载 running 态

**选择**：不修改 `isCollabLifecycleTool` / wait 排除逻辑。wait 仍为普通 tool 行；小队来自 spawn 或 synthetic children。

Running 态：`enrichSubagentCardStatuses` + child `isProcessing`。

### Decision 4: Live collab id 字段对齐（增强，非唯一依赖）

**选择**：`buildConversationItem`（collab）与 linking 侧补充 history 已支持的 `targets` / `target` / `ids` / `id` 抽取，写入 `receiverThreadIds`。

- 收益：spawn completed 更快展开真实 id。
- 仍不依赖此作为 wait 阶段唯一路径（Decision 1 兜底）。

### Decision 5: Dedupe 策略

合成卡 id 使用稳定前缀（如 `synthetic-codex-subagent:{childId}` 或复用 shared 前缀但 engine 可区分）。

`dedupeSubagentSquadCards` / agentId key：真实 spawn 到达后按 `agentId`/`sessionThreadId` 合并，**优先真实 collab tool 卡**（更高 rank：有 toolUseId / 非 synthetic）。

### Decision 6: 引擎隔离测试矩阵（硬门禁）

| 用例 | 期望 |
|------|------|
| Codex native live，3 children，仅 wait | 3 synthetic/enriched cards + Status 3 |
| Codex history 已有 spawn | 不双写 |
| Grok Shared，无 spawn tool，有 children | 仍走现 Shared synthetic（行为不变） |
| Claude live Agent tools | 不进入 Codex fallback |
| Kimi swarm | 不进入 Codex fallback |

## Risks / Trade-offs

- **[Risk] 合成与真实 spawn 双卡** → Mitigation: agentId/sessionThreadId dedupe + 优先真实 tool。
- **[Risk] Shared Claude child 被误判 Codex** → Mitigation: synthetic eligible 需 codex 信号（engine / collab wait 存在 / child 非 claude: 前缀）。
- **[Risk] Status 显示过期子会话** → Mitigation: 优先 processing 子树 + 与现 scoped root 一致。
- **[Risk] 渲染抖动** → Mitigation: synthetic 列表按 child id 排序稳定；persona 用 child id seed。
- **[Trade-off]** wait 扁条仍在 timeline 下方 → 可接受；本 change 不强制折叠 wait。

## Migration Plan

1. 落地 unit/hook tests（先红后绿）。
2. 改 presentation + status + collab id（小 diff，可分 commit）。
3. typecheck + focused vitest。
4. 人工：Codex multi-agent live wait 冒烟；Claude/Grok 各一次实时冒烟。
5. 回滚：还原 synthetic gate 与 status fallback 两处即可，无存储迁移。

## Open Questions

1. Shared 父会话上 Codex owner 的 eligible 判定：是否要求 timeline 上已出现任意 `collabToolCall` 才注入？  
   **倾向**：有 child 且 parent engine 为 codex（shared target）即可，与 native 一致；若误伤再收紧到「存在 collab wait/spawn 痕迹」。
2. wait 行是否在同 change 做折叠摘要？  
   **默认不做**，列入 follow-up。

## 关键代码锚点（实现时）

- `useMessagesPresentationState.ts` L168–202 synthetic inject
- `syntheticSharedSubagentTools.ts` — 泛化命名与 Codex toolType 可选
- `useStatusPanelData.ts` collab 分支 L269–333 + child fallback
- `threadItems.ts` collabToolCall receivers L1087–1116
- `isSubagentTool.ts` — **默认不改** wait 排除
- `subagentViewModel.ts` enrich/dedupe 可小补 rank

## 伪代码（幕布）

```
function shouldInjectCodexChildSynthetic(threadId, items, children, engine):
  if children empty: return false
  if engine is claude|grok|kimi|gemini|opencode AND not codex-shared-owner:
    return false  // 其他 CLI 硬否
  if items has isSubagentTool that expands to >=1 card with session/agent:
    return false  // 已有真实小队
  if items has only collab lifecycle OR no subagent tools:
    return isCodexContext(threadId, engine)
  return false
```
