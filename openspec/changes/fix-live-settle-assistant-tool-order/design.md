## Context

### 问题相位（已确认）

| 相位 | 观察 |
|------|------|
| 流式中 | assistant / tool 交错顺序 **正常**（用户） |
| 本轮结束后（会话仍打开） | **偶发** 结论文本出现在工具卡前 |
| 关开历史 | 顺序 **恢复正常** |
| 引擎 | Shared × Claude Code 已确认；共用路径 → Native/其他引擎 **高同源风险** |

分析：`docs/analysis/live-settle-assistant-tool-order-2026-08-04.md`。

### 架构约束（必须遵守）

- 统一幕布：Shared / Native 同一 `Messages` 核；修 L1 settlement，不重做 Row 树。
- `liveTextExternalization` **默认开**：正文旁路 `liveAssistantTextChannel`；禁止恢复 per-delta 根 reducer（见 `AGENTS.md` Render Perf Baseline）。
- Tool start → `drainLiveAssistantTextTail` **先于** `incrementAgentSegment`（已有回归）。
- `resolveLiveAssistantMessageId(state, threadId, itemId)`：`segment>0` → `{itemId}-seg-{n}`，否则裸 `itemId`。
- `onTurnCompleted`：drain → … → **`resetAgentSegment`** → `markLatestAssistantMessageFinal`；Shared 可对 **主 thread + alias** 双侧 settle。
- `onAgentMessageCompleted`：`flushAgentCompletedBatch` 后 **`clearLiveAssistantText`**（当前无强制与 segment 快照绑定）。

### 根因（对抗式 review + 单测钉死）

**H1（已证实，主路径）**：`applyCompleteAgentMessageToState` 在 `segment=0` 时：

1. `resolveLiveAssistantMessageId` → 裸 `itemId`  
2. `findAssistantMessageIndexById(list, bare)` **先命中工具前建壳的那条**  
3. **永远走不到** `findAssistantMessageIndexByPrefix`（`-seg-N` 在后）  
4. `mergeCompletedAgentText` 把终稿/结论并进工具前气泡  

流式中视觉读 `liveAssistantTextChannel` 挂在尾段 → 看起来对；complete/clear 后只剩 reducer 错挂 → 结束后错；history 用事件序重建 → 重开对。

**H2（次要）**：channel 仍只存事件层 `itemId`，drain 依赖 reducer 再解析；在 H1 修好后，**reset 前** drain（segment 仍高）本就正确；**reset 后** late append 也需与 complete 同一 lookup。

**H3（Shared 放大，未单独复现）**：alias 双 settle 仍可能放大 late complete 窗口；lookup 按 thread 列表独立，H1 修后双侧都受益。

---

## Goals / Non-Goals

### Goals

1. **Settlement-safe assistant identity**：流式建壳、tool 分段、completed、turn completed、late complete 全程，终稿/尾段只写入 **正确 segment 对应的 durable item**。
2. **顺序不变式**：同一 user turn 内，tool 开始之后产生的 assistant 结论文本，在 live settle 后仍位于相关 tool 项之后；与 history 可见序一致。
3. **Shared = Native 合同**：共用路径一次修；alias settle 不得把终稿并进错误早期 item。
4. **可测**：不依赖偶发手测作为唯一门禁；相位单测可稳定复现 R1。
5. **perf 不变坏**：不增加根链高频 setState；不关 live-text 外置。

### Non-Goals

- 不修 Grok jsonl 桥「工具晚到」的过程可见性（可另 change）。
- 不改 history loader 顺序算法作主修复。
- 不全局按 timestamp 重排 `itemsByThread`。
- 不改 scroll / virtualization / presentation expansion。

---

## Decisions

### D1. 采用 settlement-safe **assistant 查找**（已落地），channel bind 为增强项

**决策（P0，已实现）**：在 reducer 增加 `findAssistantMessageIndexForLiveSettlement(list, itemId, segmentedItemId, mode)`：

| mode | 行为 |
|------|------|
| `complete` | 裸 base + 已有 `-seg-*` → **最新分段**；缺失的 `-seg-N` resolve → 回退最新分段 |
| `append` | 同上「裸 base + 兄弟」规则；**缺失的 `-seg-N` 必须 return -1 建新壳**（禁止并回裸 base） |

接入：`appendAgentDelta`、`applyCompleteAgentMessageToState`。

**P1 增强（未必须）**：channel 记 `durableItemId` / `segmentAtBind` — 降低对 lookup 的依赖；H1 不依赖此项即可止血。

**备选否决**：settle 时 `sort(items)` — 不稳定、伤其它投影。

### D2. Turn terminal 与 segment reset 的时序契约

**决策**（实现顺序，可微调但必须满足不变式）：

```text
1. drain live-text tail → 写入 **bind 时** durable id（非 reset 后 seg0）
2. 处理/合并任何 pending complete（同 bind 规则）
3. clear live channel（仅在 tail 已 durable 或 complete 已覆盖全量后）
4. markTerminalSettlement / finalize tools / …
5. resetAgentSegment
6. markLatestAssistantMessageFinal（仍指向时间线最后一条 assistant，不改文本挂载）
```

**Late complete 规则**：若 `completeAgentMessage` 到达时 `agentSegmentByThread` 已 0 且本 turn 已 terminal，MUST：

- 用 **itemId 的已有分段实例**（`itemId`、`itemId-seg-1`…）中 **最后匹配前缀/活跃壳** 更新，或  
- 用 complete 载荷携带的 `segmentHint` / `durableItemId`（若事件层可补），  
- **MUST NOT** 把长终稿 `mergeCompletedAgentText` 进本 turn 内位于 **第一个 tool 之前** 的 assistant，除非 complete 文本与该早期段既有正文等价（防误伤真·早期段 complete）。

推荐实现形状（选一，design 层允许实现选细节）：

| 形状 | 说明 |
|------|------|
| **A. channel stores `durableItemId`** | drain/complete 直写该 id；reset 不影响 |
| **B. segment epoch / generation** | reset 递增 epoch；旧 epoch 的写入忽略当前 segment 计数 |
| **C. turn-scoped segment freeze** | turn terminal 后冻结 segment 表只读解析到 reset 前快照 |

优先 **A**（与现有 channel per-thread 模型最贴）；若 complete 不经 channel，对 `applyCompleteAgentMessageToState` 增加 **last-bound durable id** 或 **scan tool-separated last assistant for this base itemId**。

### D3. `onAgentMessageCompleted`：clear 前保证 durable 收敛

**决策**：

- complete 路径 MUST 将最终 body 写入正确 durable item（D1）。
- **仅当** complete text 已覆盖 channel 全量（或 channel 为空 / 同 item 已 merge）后才 `clearLiveAssistantText`。
- 若 complete text 偏短而 channel 更长：MUST drain tail 到 **同一 durable id** 再 clear（禁止丢尾或写错段）。

### D4. Tool 边界既有行为保留

**决策**：保留「tool start → drain → `incrementAgentSegment`」顺序；扩展测试不得回退该不变量。本 change 焦点是 **turn terminal / late complete**，不是重写 tool 边界。

### D5. Codex native dedupe

**决策**：不扩大 `shouldDeduplicateCodexAssistantMessages` 到 Shared。Native Codex 在 tool 分隔段上已有「非等价保持分离」测试；本 change 增加 **complete after tools 不得并回 tool 前段** 的用例。若 dedupe 与 D1 冲突，以 **tool 分隔顺序不变式** 优先。

### D6. Shared alias

**决策**：`onTurnCompleted` 的每个 `safeTargets` 独立执行 D2 顺序；drain/complete 的 durable id 绑定在 **该 threadId** 的 channel/state 上，禁止用 thread A 的 channel 写入 thread B 的早期 item。

### D7. 可观测性（可选但推荐）

- 开发/诊断：当 complete/drain 的 resolved id 与「当前 segment 解析结果」不一致时，记 **bounded** debug（threadId、base itemId、segment、chosen durable id、reason）；**禁止**记录用户/助手全文。

---

## 顺序不变式（合同级）

对任意 user turn 的 live items 子序列（过滤 hidden bash 等呈现策略之后的 **逻辑序**）：

1. 若存在 tool 项 T 与 assistant 项 A，且 A 的 **首次建壳**发生在 T 的 start 处理之后（segment 已自增），则 settle 后 A 在数组中的下标 **MUST >** T。
2. History hydrate 对等价 turn 的可见 assistant/tool 交错序 MUST 与 (1) 在 live settle 后一致（允许 id/时间戳差异）。
3. 不得要求用户「重开会话」才能满足 (1)(2)。

---

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 多 complete 同一 base itemId 找不到「正确最后段」 | 维护 `lastDurableAssistantIdByThread` 在 segment++ / 建壳时更新 |
| 早期段合法 late complete 被拒 | 等价正文 merge 到匹配段；仅阻止「长结论并进 tool 前空/短壳」类误挂 |
| 双 channel 模型复杂度 | 仍 per-thread 单槽；只加 durableId/segment 字段 |
| 测试假阳性 | 用 reducer 纯函数测 applyComplete + 事件序，不依赖真实 CLI |

---

## Migration Plan

- 无持久化 schema 变更；无数据迁移。
- Flag：优先 **默认修复**（行为 bugfix）。若需紧急回退，可用既有 `liveTextExternalization=0` 作 perf 回退，**不是**顺序 bug 的正式回退；正式回退 = git revert。

---

## Open Questions

1. Claude 是否会在同一 turn 对 **同一 itemId** 多次 `agentMessage` completed（每段一次）还是仅最终一次？→ 实现时以 adapter 事件为准，测试两种。
2. Native Claude 是否已能稳定复现？→ P0 手测；若仅 Shared 复现，仍落地 D1/D2（同源）并加强 alias 测试。
3. 是否需要用户可见 toast？→ **否**；静默修正确序即可。

---

## 实现地图（供 tasks 引用）

| 步骤 | 区域 |
|------|------|
| 1 | `liveAssistantTextChannel`：entry 增加 `durableItemId` 或 `segmentAtBind`；drain API 返回该字段 |
| 2 | `useThreadItemEvents`：delta/snapshot/tool drain/complete 写入与读取 bind id |
| 3 | `useThreadsReducer` / `applyCompleteAgentMessageToState`：late complete 安全解析 |
| 4 | `useThreadTurnEvents` `onTurnCompleted`：D2 顺序与 reset 解耦 |
| 5 | Vitest：liveTextSegment 扩展 + settle 相位 + Shared 双 target（若可测） |
| 6 | 更新分析文档状态 → OpenSpec change 链接 |

## Test Plan

### 自动化

1. 文1 → tool start（segment++）→ 文2 deltas in channel → turn completed drain+reset → 文2 在 tool 后。
2. 同上 + **reset 后** late `completeAgentMessage(baseItemId, 长结论)` → 不得写入 tool 前段。
3. complete 短文本 + channel 更长 → drain 同 durable id 后 clear，无丢尾。
4. 既有 tool 边界 drain-before-increment 全绿。
5. Codex tool-separated non-equivalent + complete 保持两段且序正确。

### 手测（P0）

| # | 会话 | 引擎 | 操作 | 期望 |
|---|------|------|------|------|
| 1 | Shared | Claude | 多 tool + 长结论，结束后不关会话 | 结论在 tool 后 |
| 2 | Native | Claude | 同上 | 同上 |
| 3 | Shared | Claude | 关开历史 | 与结束后一致 |
| 4 | Shared | Codex | 抽样 | 不回归 |

---

## 回滚

单 commit/PR revert；无 DB/磁盘兼容负担。
