---
type: analysis
status: active
---

<!-- DOC-LIFECYCLE: active-reference -->
> [!NOTE]
> **Lifecycle: Active incident / cross-engine analysis.** 现象已人工确认；修复未开工。Current contract 仍以 [OpenSpec main specs](../../openspec/specs/README.md) 与代码为准。本文不替代行为规格。

# Live settle 后助手结论文本落到工具前（跨 CLI 排查）

> **对照产品**：`0.7.16` · 分支 `CXN-version-0.7.16`  
> **确认日期**：2026-08-04  
> **报告人现象**：Shared 绑 Claude Code  
> **范围**：Shared + Native；全引擎同源风险矩阵  
> **修复状态**：OpenSpec change **进行中** → [`openspec/changes/fix-live-settle-assistant-tool-order/`](../../openspec/changes/fix-live-settle-assistant-tool-order/)（proposal / design / specs / tasks 已齐）  
> **姊妹文**：[对话幕布结构](./conversation-canvas-structure-2026-07-31.md) · [live tool projection matrix](./canvas-live-tool-projection-matrix-2026-08-01.md) · [Native vs Shared](./native-vs-shared-cli-explained.md) · [A4 live-text 方案](../perf/a4-live-text-externalization-plan.md)

---

## 0. 30 秒结论

| 项 | 内容 |
|----|------|
| **已确认现象** | 多工具回合：**流式中顺序看起来正常** → **本轮结束后偶发**「结论/方案正文出现在工具卡前面」→ **关对话再开历史又正常** |
| **确认引擎** | Shared Session 绑定 **Claude Code**（用户二次确认） |
| **不是** | 历史 loader 写乱顺序；纯 CSS 排版；Grok 专用 jsonl 桥（本次报告引擎不是 Grok） |
| **更像** | live 内存态在 **turn settlement** 后与真实事件序分叉；磁盘/history 重建仍正确 |
| **架构面** | Shared 与 Native **共用**同一套幕布核 + 同一套 live-text / segment / settle 链 → **同类问题具备跨 CLI 条件**，不限于 Shared、不限于 Claude |
| **修复状态** | OpenSpec `fix-live-settle-assistant-tool-order`；**双路径已落地**：(1) settlement lookup 防 late complete 写回 pre-tool；(2) late tool 插入/rebalance 防「终稿 isFinal 后工具挂在结论后」（Grok bridge / 任意晚到 ToolStarted）。手测：Shared×Grok 复现帧已对齐第二路径 |

---

## 1. 现象确认（事实，非猜测）

### 1.1 用户侧复述

1. 使用 **Shared**，目标引擎 **Claude**（Claude Code）。
2. 回合内有多轮工具（截图可见 Skill / MCP Codegraph / Search / 批量 Read 等）。
3. **流式进行中**：时间线「好像是对的」。
4. **本轮结束后**：结论/方案类正文出现在工具调用块**前面**（错序仍保留在当前打开的会话里）。
5. 建议「关了重开对话看历史」后：用户确认 **重新开看历史就好了**。
6. **偶发**，非每轮必现。

### 1.2 对照截图语义（会话内）

- **问题帧**：助手结论文案在上，红框工具过程卡在下 → 读起来像「先给结论再查代码」。
- **恢复帧**：重开历史后工具过程与方案结构顺序正常。

### 1.3 诊断分桶（已收窄）

| 假设 | 状态 | 依据 |
|------|------|------|
| 流式中 tool 边界未 drain，正文当场挤坨 | **降权** | 用户：流式中好像正常 |
| 历史 loader / 磁盘顺序错误 | **排除** | 重开历史正确 |
| 仅 Shared 独有 UI 树 | **排除** | Shared/Native 同一 `Messages` 渲染核 |
| **终轮 settle 后 live items 错挂** | **主嫌疑** | 结束后错 + 内存态 vs 历史源分叉 + 偶发 race 形 |
| 仅 Claude adapter 独有逻辑 | **待证** | 核心 settle/segment 链是引擎共享的；Claude 只是已确认 case |

### 1.4 大白话

> 聊天过程中看起来还行；**一说「本轮结束」就偶尔把最后那段话塞到工具前面去了**。  
> 关掉再打开等于**用正确的历史重画一遍**，所以又好了。  
> 不是硬盘写错了，是**结束那一下内存列表偶发写歪**。

---

## 2. 数据面：为什么「重开就好」

```text
实时流 ──► liveAssistantTextChannel（旁路） + itemsByThread（reducer，含 segment id）
              │
              │  turn completed / settled
              ▼
         drain / complete / resetAgentSegment / markFinal
              │
              ├─ 内存 items 偶发错序  ← 用户仍停在当前会话时看到
              │
磁盘/CLI 历史 ──► history loader ──► 正确顺序  ← 关开后看到
```

要点：

- History 读的是 **Claude/引擎侧可恢复 transcript**（或 Shared canonical 落盘），**不是**「把当前坏掉的内存数组原样序列化再读回来」这一种单一路径。
- 因此：**历史对 ≠ 当前 live 内存对**。Workaround 有效只说明「正确源存在」，不说明 settle 无 bug。

---

## 3. 共享代码路径（Shared 与 Native 一起看）

统一幕布后，差异主要在 **L1 水管（adapter/loader）**，不在 Row 树。下列链路 **Shared / Native 共用**：

| 环节 | 路径 | 作用 |
|------|------|------|
| live-text 旁路 | `src/features/threads/utils/liveAssistantTextChannel.ts` | 流式正文外置；flag `liveTextExternalization` **默认开** |
| tool 边界分段 | `useThreadItemEvents.ts` → `incrementAgentSegment` | tool start 时分段，保证「文 → 工具 → 文」多段 assistant |
| 分段前 drain | 同上，`drainLiveAssistantTextTail` **早于** `incrementAgentSegment` | 防「本段正文永久丢失 / 挤到工具前」 |
| itemId 解析 | `resolveLiveAssistantMessageId`（`threadReducerCoreHelpers.ts`） | `segment>0` 时写成 `{itemId}-seg-{n}` |
| agent 终稿 | `onAgentMessageCompleted` → `flushAgentCompletedBatch` / `completeAgentMessage` | 终稿进 reducer，并 **`clearLiveAssistantText`** |
| 回合 settle | `useThreadTurnEvents.ts` `onTurnCompleted` | drain 尾段 → … → **`resetAgentSegment`** → `markLatestAssistantMessageFinal` |
| 中断 drain | `useThreadMessaging.ts` | 中断前 drain，避免只剩建壳首段 |
| 渲染核 | `Messages → MessagesCore → Timeline → TimelineRowRenderer` | Shared `threadKind=shared` 与 native 同核 |

### 3.1 会触发 segment++ 的 tool 类型（引擎无关，看 item.type）

`useThreadItemEvents` 在 `onItemStarted` 路径上，对以下 type 在 processing 中会 `incrementAgentSegment`：

- `commandExecution`
- `fileChange`
- `mcpToolCall`
- `collabToolCall` / `collabAgentToolCall`
- `webSearch`
- `imageView` / `generatedImage` / `generated_image` / `image_generation_*`

**含义**：任何引擎只要把「读/写/搜/MCP/命令」投成上述 type，就会走同一套「分段 + live-text drain」契约。Claude 截图里的 Skill/MCP/Search/Read 只要映射进这些 type（常见为 `commandExecution` / `mcpToolCall` 等），即进入该契约。

### 3.2 终轮 settle 顺序（关键）

`onTurnCompleted` 对每个 safe target（含 Shared alias 双 thread 时）：

1. `drainLiveAssistantTextTail` → 可能 `appendAgentDelta`
2. `markTerminalSettlement` / `finalizePendingToolStatuses` / plan settle …
3. `resetAgentSegment`（**分段计数归零**）
4. `markLatestAssistantMessageFinal`

与此并行/交错的还有：

- 各引擎的 `agentMessage` **completed**（`completeAgentMessage`）：写终稿后 **直接 clear 通道**（见下节注意点）
- Shared 时 `aliasThreadId` 与主 threadId **双侧 settle**

### 3.3 已有回归注释（与现象同构，但触发相位不同）

`useThreadItemEvents.liveTextSegment.test.ts` 文件头：

> liveTextExternalization 开启后……若不在分段前把通道尾段灌回……界面表现为「**整轮正文挤成一坨排在所有工具之前**」。

该测试主要锁 **tool 边界** drain，不锁 **「流式正确 → settle 后错」** 相位。  
本次用户现象 = **settle 相位变体**；同源组件，不同时点。

---

## 4. 主嫌疑机制（仍属分析，待代码钉死）

### 4.1 画像

多段时间线在流式中大致为：

```text
[assistant seg0 · 开场]
[tool …]
[tool …]
[assistant segN · 结论]  ← live channel 视觉挂在尾段
```

偶发在 **turn complete / settle** 后：

- 结论文本被写进 **seg0（工具前）** 的 assistant item；或
- 尾段只剩建壳/空，通道被 clear，终稿合并进了错误 index。

用户观感 = 「结论在工具前面」。

### 4.2 高嫌疑 race（共享路径）

| # | 机制 | 为何匹配「流式对 / 结束后错 / 偶发」 | 修复 |
|---|------|--------------------------------------|------|
| R1 | `resetAgentSegment` 之后仍有 `completeAgentMessage` / `appendAgentDelta` | segment=0 裸 `itemId` 命中**本轮第一段** assistant | **已修** `findAssistantMessageIndexForLiveSettlement` |
| R2 | `onAgentMessageCompleted` clear 通道且不先 drain | 尾段丢失/错挂 | P1 可选 |
| R3 | Shared 双 threadId settle | 放大 R1 | R1 双侧受益 |
| R4 | complete 查找顺序 | 终稿并进早期气泡 | 同 R1 |
| **R5** | **晚到 tool append 在 list 尾**（Grok jsonl 桥 / 任意 late ToolStarted） | 结论文本已在 list 中甚至 `isFinal`，工具后挂 → 幕布「结论在上、工具在下」；history 序仍对 | **已修** `upsertItem` 在 final trailing 前插入 + `rebalanceTrailingToolsBeforeFinalAssistants`（complete / markFinal） |

#### 2026-08-04 手测复现（Shared × Grok）

- Prompt：P0-3（先工具后长结论）
- 现象：长技术说明在上，底部「批量读取文件」组在下（与原 Claude 观感同构）
- binding：`grok:default` → 优先 **R5**（桥滞后），R1 仍保留为 Claude 分段路径

### 4.3 Codex 额外风险（Native only 的 dedupe）

`shouldDeduplicateCodexAssistantMessages`：

- **Native Codex**：可对等价正文做 assistant 合并；
- **Shared**（`threadKind === "shared"`）：**关闭**该 dedupe。

因此：Native Codex 在「工具分隔的多段正文」上除 R1–R2 外，还有 **等价合并** 历史债（已有测试 `keeps tool-separated non-equivalent codex assistant segments separate`，但边界文本仍可能踩坑）。Shared 绑 Codex 时 dedupe 关，但 **segment/live-text settle 仍共用**。

### 4.4 非主因但仍相关

| 项 | 说明 |
|----|------|
| Grok jsonl tool 桥 | 工具可见性/滞后问题；可造成「文先工具后补」观感，但是 **另一类**；且本次确认引擎是 Claude |
| 流式尾窗 `STREAMING_VISIBLE_WINDOW` | 裁旧不致「结论挪到工具前」 |
| presentation 折叠 / 详情延迟 | 行级摘要墙已下线；与本次错序描述不符 |

---

## 5. 跨 CLI 风险矩阵（Shared + Native）

图例：

- **已确认**：人工复现/用户确认  
- **高（同源）**：走同一 settle/segment/live-text，具备相同 race 条件  
- **中**：同源 + 额外引擎特化  
- **低/不同**：runtime 不可用或路径差异大  
- **未测**：需手测，不因「没报告」当无问题  

| Engine | Native | Shared 白名单 | live tool 信号 | 是否走共享 segment + live-text + onTurnCompleted | 错序同源风险 | 备注 |
|--------|--------|---------------|----------------|--------------------------------------------------|--------------|------|
| **Claude** | ✅ | ✅ | stream Tool* → command/mcp 等 | ✅ | **已确认（Shared）**；Native **高（同源，未测）** | 本 incident 锚点 |
| **Codex** | ✅ | ✅ | item/* tool | ✅ | **高（同源）**；Native 另有 dedupe | 工具分隔段测试在 reducer 层有，**无 settle-after-stream 相位测试** |
| **Kimi** | ✅ | ✅ | stream tool_calls | ✅ | **高（同源）** | 多 tool 长结论回合优先手测 |
| **OpenCode** | ✅ | ✅ | stream Tool* | ✅ | **高（同源）** | 同上 |
| **Grok** | ✅ | ✅ | stdout 无 tool；**jsonl tail 桥** | ✅ 共用 settle；tool 时钟弱 | **高（同源）+ 中（桥滞后）** | 可能叠「文先 tool 后到」；与本 incident 相位可不同 |
| **Gemini** | 代码在；`GEMINI_RUNTIME_ENABLED=false` | ❌ | 既有 adapter | 代码路径存在 | **低（产品 runtime 不可用）** | 不进 Shared 白名单 |

### 5.1 Shared vs Native 是否「两套 bug」？

| 问题 | 答案 |
|------|------|
| Shared 是否单独一套 Messages？ | **否**。同一渲染核；Shared 多历史投影 + 发送条 + binding。 |
| 是否只有 Shared 会 settle 错序？ | **否**。segment/live-text/onTurnCompleted 不看 threadKind。 |
| Shared 为何可能「更容易偶发」？ | alias 双 target settle、binding 与可见 `shared:` id 事件交错 → **放大 race 窗口**，不是另一棵 UI 树。 |
| Native Claude 要不要测？ | **要**。若 Native 也能复现 → 钉死纯共享路径；若仅 Shared → 优先查 alias/settle 双写。 |

### 5.2 手测优先级（扩大 CLI 范围）

**复现 prompt 形态**（与原报告接近）：

> 先多次 Read/Search/MCP，再输出较长结构化结论（方案 A/B/C + 列表）。  
> 观察：**流式中顺序** vs **isProcessing 结束后顺序** vs **关开历史顺序**。

| 优先级 | 会话 | 引擎 | 目的 |
|--------|------|------|------|
| P0 | Shared | Claude | 回归锚点；尽量多 tool + 长结论 |
| P0 | Native | Claude | 剥离 Shared alias 变量 |
| P1 | Shared / Native | Codex | 同源 + Native dedupe |
| P1 | Shared / Native | Kimi、OpenCode | 原生 stream tool 是否同样 settle 错 |
| P2 | Shared / Native | Grok | 区分「桥滞后」vs「settle 错挂」 |
| — | Gemini | — | runtime 关，跳过 |

**判定表**（每引擎填一次）：

| 观察点 | 正常 | 本 incident 阳性 |
|--------|------|------------------|
| 流式中 | 文/工具交错合理 | 合理 |
| 本轮结束后（不关会话） | 与流式一致 | **结论跑到工具前** |
| 关开历史 | 与正确事件序一致 | 正确（修复内存态） |
| 频率 | — | 偶发也可记 1 次 + 工具数量/是否 Shared |

---

## 6. 源码索引（排障入口）

| 主题 | 文件 |
|------|------|
| live-text 通道 | `src/features/threads/utils/liveAssistantTextChannel.ts` |
| perf flag | `src/features/threads/utils/realtimePerfFlags.ts`（`liveTextExternalization`） |
| tool 分段 + 边界 drain | `src/features/threads/hooks/useThreadItemEvents.ts` |
| agent completed + clear 通道 | 同上 `onAgentMessageCompleted` |
| turn settle + reset segment | `src/features/threads/hooks/useThreadTurnEvents.ts`（`onTurnCompleted`） |
| segment id | `src/features/threads/hooks/threadReducerCoreHelpers.ts` → `resolveLiveAssistantMessageId` |
| complete/merge | `src/features/threads/hooks/useThreadsReducer.ts` → `applyCompleteAgentMessageToState` |
| Codex dedupe | `src/features/threads/hooks/useThreadsReducerAssistantDedup.ts` |
| 边界回归（流式分段） | `src/features/threads/hooks/useThreadItemEvents.liveTextSegment.test.ts` |
| Shared 引擎白名单 | `src/features/shared-session/utils/sharedSessionEngines.ts` |
| 幕布结构 | `docs/analysis/conversation-canvas-structure-2026-07-31.md` |

---

## 7. 建议后续（未执行，仅登记）

1. **钉死 race**：对 `onTurnCompleted` 与 `onAgentMessageCompleted` 做时序日志或单测：  
   `resetAgentSegment` 之后禁止再把本 turn 的 complete/delta 解析到 seg0 裸 id（或 complete 携带 segment 快照）。
2. **补相位回归**：  
   `文1 → tool → 文2(长结论) → turn completed(含 late complete)`  
   断言 items 顺序仍为 文1, tool, 文2；并覆盖 Shared 双 threadId。
3. **P0 手测**：Native Claude 对照 Shared Claude。  
4. **修前不改 history loader**；优先 settle / segment / live-text 收敛契约。

---

## 8. 变更记录

| 日期 | 内容 |
|------|------|
| 2026-08-04 | 初版：现象确认（Shared×Claude；流式对、结束后偶发错、历史恢复）；Shared+Native 全引擎同源矩阵与手测优先级 |
