---
type: plan
status: active
owner: conversation-curtain
priority: P0-history-window + P1-order
created: 2026-08-18
updated: 2026-08-18
---

<!-- DOC-LIFECYCLE: active-execution-plan -->

# 幕布历史顶部丢失 + 消息顺序/用户气泡连堆（0.9 后）

> **读者**：接手修复的人或 AI。本文是排查结论 + 实施清单，不是 OpenSpec 行为契约。
> **日期**：2026-08-18
> **对照产品**：mossx **v0.9.0**（2026-08-17）及之后的当前 main
> **状态**：P0 Bug A 已 OpenSpec 化并落地（`fix-claude-history-disk-window-load-more`）；单测 117/117 绿；**尚未**真机 >80 Claude 手滑（T5）；P1 Bug B 未开
> **排查方式**：静态代码追踪（2026-08-18）。未打开 App 用 >80 条 Claude 会话复现。
> **产品行为真相源**：当前代码 + 未来 OpenSpec change。本文不得覆盖更高优先级事实源。
> **相关 OpenSpec（邻近、不要混进本修复当主因）**：
> - `openspec/changes/fix-live-settle-assistant-tool-order/`
> - `openspec/changes/fix-assistant-duplicate-render-native-shared/`
> - `openspec/changes/fix-shared-history-projection-nonblocking/`
> - `openspec/changes/fold-background-task-notification/`（0.9 已部分落地）
> **幕布合同**：`docs/reference/conversation/conversation-curtain-contracts.md`
> **性能红线**：`AGENTS.md` Render Perf Baseline；禁止恢复逐 delta 进根 reducer；禁止重开时间线虚拟化当修复

---

## 0. 给接手 AI 的开场（复制即用）

```text
请按 docs/plans/2026-08-18-conversation-curtain-history-missing-and-order.md 执行。
1) 先读 §1 结论、§2 Bug A、§3 Bug B、§6 禁止项。不要猜，不要把邻近 OpenSpec 当本 bug。
2) 命中 OpenSpec 工作区：先 openspec-new-change（或用户指定 change-id），再改代码。
3) P0 只修 Bug A（Claude 磁盘尾窗 80 与幕布 load-more 断线）。P1 才动 Bug B。
4) 禁止：把 Claude 80 改回全量当主修复；按 timestamp 全局重排 items；重开虚拟化；整文件 --ours/--theirs。
5) 完成后回写本文 Todo / Progress Log，禁止主动 git commit。
```

### 0.1 勾选约定

| 标记 | 含义 |
|------|------|
| `[ ]` | 未开始 |
| `[~]` | 进行中 / 部分完成 |
| `[x]` | 已完成且有证据 |
| `[!]` | 阻塞 / 需决策 |

---

## 1. 30 秒结论

升级 0.9 后用户看到两类幕布问题。**当前代码里都还在。** 它们不是同一个根因，必须分开修。

| ID | 用户体感 | 当前还在？ | 主因一句话 | 优先级 |
|----|----------|------------|------------|--------|
| **A** | 打开历史会话，上面的消息没了；滑到顶部也没有「显示更多」 | **在，Claude Native 最重** | 0.9 给 Claude 加了磁盘尾窗 80，并把 `hasMore` 写进 reducer；幕布芯片/滑顶从不读这个字段，也不打 `loadClaudeSession({ before })` | **P0** |
| **B** | 整段顺序错乱；用户蓝气泡连续堆叠 | **在，多因叠加** | 空 assistant 被 `prepareThreadItems` 丢掉；optimistic 与 history 文案对不齐；`setThreadItems` merge 把对不上的 incoming append 到末尾 | **P1** |

**不是**：时间线虚拟化（已永久关闭）、CSS 堆叠、DOM 800 窗把 80 条裁掉、`hasMore` 字段名 camelCase/snake_case 挂掉。

**0.9 为什么突然显出来**：changelog 同时做了两件打架的事——DOM/首屏窗口加大（更不容易出芯片）+ Claude 磁盘只加载最后 80 条（更早历史根本没进内存）。三层窗口都认为「已经全量」，芯片消失，更早历史变成静默丢失。

---

## 2. Bug A — 历史顶部丢失，滑到顶没有更多

### 2.1 用户现象（验收口径）

1. 升级到 0.9 后打开一条 **很长的 Claude Native 历史会话**。
2. 幕布从某条较新的消息开始，更早的轮次看不到。
3. 滑到顶部、点回顶，都不会出现「上方还有 N 条」芯片，也不会加载更早消息。
4. 体感：历史被截断，且没有继续往前翻的入口。

### 2.2 复现条件（最小）

- 引擎：**Claude Native**（`threadId` 以 `claude:` 开头）
- 磁盘 JSONL 对应的规范化 item 数 **> 80**
- 操作：从侧栏打开该会话 → 滑到幕布顶部
- 预期失败：顶部就是磁盘尾窗的第一条；无芯片；滑顶无加载

非 Claude / Shared：一般不吃这 80 截断。若已加载进内存的 items > 300，芯片可以展开内存段；滑顶仍然不会自动加载。

### 2.3 根因（三层窗口断线）

幕布历史被切成三层，**各自为政**：

```
① 磁盘尾窗 (Claude only)
   CLAUDE_UI_HISTORY_WINDOW = 80
   后端返回 hasMore / nextCursor
   前端写入 historyWindowByThread
        │
        │  ✗ 幕布从不读取 historyWindowByThread
        │  ✗ 没有任何路径调用 loadClaudeSession({ before })
        ▼
② 内存首屏 (全引擎)
   THREAD_ITEMS_FIRST_PAINT_COUNT = 300
   超过 300 的更早段进 pendingOlderHistory
   芯片点击 → takeNextOlderHistoryBatch → prependThreadItems
        │
        │  Claude 只进了 80 条，80 < 300，本层永不激活
        ▼
③ DOM 表现窗 (全引擎)
   DEFAULT_HISTORY_WINDOW_SIZE = 800
   只裁 reducer 里已有的 items；有 turnId 时切口回退到段首
        │
        │  80 < 800，本层也不裁，芯片计数为 0
        ▼
幕布芯片 / 滑顶 / 回顶按钮
   只认 ② 和 ③
   滑顶只改 scrollTop，不加载
```

**根因不是「渲染把顶部藏了」，是「0.9 做了磁盘截断，没把 load-more 接到幕布」。**

### 2.4 代码事实源（必须按这些文件改，不要另起平行通道）

| 层级 | 路径 | 当前行为 |
|------|------|----------|
| 磁盘窗口常量 | `src/features/threads/loaders/claudeHistoryLoader.ts` L35, L2494–2532 | `limit: CLAUDE_UI_HISTORY_WINDOW`（80）；把 `hasMore`/`nextCursor` 写入 snapshot meta |
| resume 直载 | `src/features/threads/hooks/useThreadActionsResumeThread.ts` L1238–1297 | 同样 `{ limit: 80 }`；若无 pending memory history，dispatch `setThreadHistoryWindow` |
| 统一 loader 路径 | 同文件 L579–585 | 同样把 `assembledSnapshot.meta.historyHasMore` 写入 reducer |
| 后端分页（已齐） | `src-tauri/src/engine/claude_history.rs` ~2073–2126 | 已支持 `limit` + `before`，返回 `has_more` / `next_cursor` |
| IPC 字段名（已齐） | Rust `#[serde(rename = "hasMore")]`；`src/services/tauri/session.ts` L294–304 | `loadClaudeSession(path, id, { limit, before })` 已存在 |
| 死字段 | `src/features/threads/hooks/useThreadsReducer.ts` `setThreadHistoryWindow` ~1916–1933 | 只写 `historyWindowByThread` |
| 全仓读取 | `rg historyWindowByThread` | **只出现在 reducer / identity remap / 测试**。`src/features/messages/**` **零读取** |
| 芯片点击 | `src/features/messages/components/MessagesCore.tsx` L550–568, L1349–1368 | 先 `tryLoadOlderHistoryPage`（只认 pending memory），再 `revealNextHistoryPage`（只放大 DOM 窗） |
| 内存 pending | `src/features/threads/utils/pendingOlderHistory.ts` | 只服务 first-paint 300 的内存尾 |
| requester | `src/features/threads/hooks/useThreadActionsResumeThread.ts` L160–178 + `olderHistoryRequestBridge.ts` | requester **只** `takeNextOlderHistoryBatch` + `prependThreadItems`，**从不**打磁盘 `before` |
| 滑顶 | `MessagesCore.tsx` `handleCanvasScroll` L1419–1421 | 只更新锚点 |
| 回顶按钮 | 同文件 L1425–1437 | `scrollTo({ top: 0 })`，不加载 |
| 芯片可见计数 | 同文件 L1745–1746 | `presentationCollapsedHistoryItemCount + pendingOlderHistoryCount`，**不含** `historyWindowByThread.hasMore` |
| 首屏切片 | `src/features/threads/utils/dispatchThreadItemsProgressively.ts` L4–7, L74–78 | `items.slice(-300)`，无 turn 边界保护 |
| DOM 裁剪 | `src/features/messages/orchestration/presentation/messagesHistoryWindow.ts` | 默认 800；有 `turnId` 时切口回退 |
| 虚拟化 | `src/features/messages/timeline/virtualization/messagesTimelineVirtualization.ts` L72–79 | `shouldVirtualizeTimelineRows` **恒 false** |

### 2.5 0.9 引入点（changelog 原文）

`CHANGELOG.md` v0.9.0 Improvements：

- 「会话历史窗口加大：DOM 默认窗口 150 → 800，首屏尾窗 16 → 300，长会话不再一打开就缩成 chip」
- 「Session Index … Claude 磁盘尾窗默认 80」

两件事一起上：用户更不容易看到芯片，磁盘却只给 80 条。80 < 300 < 800，三层全部静默。

### 2.6 意图态 vs 现状

| 该发生的 | 实际发生的 |
|----------|------------|
| 打开长 Claude 会话：先画最近一段，顶部有「还有更早」入口 | 只画 80 条，无入口 |
| 点芯片或滑近顶部：先吐内存 pending，再按 `nextCursor` 打磁盘 `before` | 只吐内存 pending；磁盘分页 API 闲置 |
| `historyWindowByThread.hasMore` 驱动芯片 | 字段写入后无人读 |
| 滑到顶至少露出芯片或自动翻一页 | 只滚动，不加载 |

### 2.7 引擎差异（修 A 时不要误伤）

| 引擎 | 磁盘是否截 80 | 芯片现状 | 本 change 要做什么 |
|------|---------------|----------|--------------------|
| Claude Native | **是** | 会话 >80 时通常无芯片 | **主修复面** |
| Codex / 其他 Native | 未见同等 80 截断 | >300 有芯片，点芯片能展开内存段 | 不要改它们的 loader limit；滑顶自动加载可选、非必须 |
| Shared | V0 全量 + 后台 projection merge | 不吃 Claude 80 | **不要**把 Shared 历史改成 80 尾窗 |

---

## 3. Bug B — 顺序错乱 + 用户气泡连续堆叠

### 3.1 用户现象（验收口径）

两类可以同时出现，根因不同，不要合成一个「排序函数」去修：

1. **连堆**：幕布右侧连续多条用户蓝气泡，中间没有助手回复。
2. **错序**：整段时间线乱，工具/助手/用户的相对位置和真实发生序不一致；有时重开历史又正常。

### 3.2 根因拆条（必须按条修，禁止全局 sort）

#### B1. 空 assistant 被丢掉 → 两条 user 贴在一起（连堆主因）

`src/utils/threadItems.ts` `prepareThreadItems` L784–792：

- `role === "assistant"` 且 `text.trim()` 为空、无 images、无 `executionTargetSnapshot` → **直接 `continue` 丢掉**
- live-text 外置后，流式正文在 `liveAssistantTextChannel`，reducer 里常是空壳
- 中途 `setThreadItems` / hydrate / settle 再跑一遍 prepare，空壳消失
- 结果：`user → (空 assistant 被丢) → user`，视觉上蓝气泡连堆

#### B2. optimistic 与真实 user 对不齐 → 双份蓝气泡

`src/features/threads/hooks/threadReducerOptimisticItemMerge.ts`：

- 收敛条件：全文+图等价，或同 turn 文案等价（`isEquivalentUserObservation` / `isTextEquivalentUserTurn`）
- history 若包了 memory / note-card / agent-prompt 包装，归一化后对不上
- 结果：optimistic 气泡留下，真实 user 再来一条
- 0.9 已补「Shared 投影丢图时把 optimistic 附图补回」。**包装文案漂移仍在**

#### B3. merge leftover incoming 无条件 append → 整段错序

同文件 L249–274：

1. 先按 **local 顺序** 走已匹配 id
2. 再把 incoming 里还没 emit 的 **全部 `push` 到末尾**

典型触发：

- 画布已有较新 local items（含 optimistic / live）
- 迟到的 `setThreadItems` 带着 Claude 80 尾窗或 Shared projection
- 对不上的更早 incoming 被接到最新消息后面

用户体感：下面突然冒出更早一轮，或助手/工具交错。

`setThreadItems` 入口：`useThreadsReducer.ts` ~1956 调 `mergeThreadItemsPreservingOptimisticUsers`。

#### B4. 首屏 `slice(-300)` 不守 turn 边界

`dispatchThreadItemsProgressively.ts` L74–78 裸切片。  
DOM 800 窗（`resolveHistoryWindowCutIndex`）会把切口回退到同 `turnId` 段首。  
内存首屏不会。用户会觉得「这一轮上半截没了」。这是 A 的加重项，也是 B 的「看起来像丢了中间」项。

#### B5. 邻近问题（本 plan **不要当主修复**，但验收时要能区分）

| 项 | 状态 | 看起来像 | 处理 |
|----|------|----------|------|
| `<task-notification>` 当用户蓝气泡 | 0.9 已修（`fold-background-task-notification`） | 假用户气泡连堆 | 回归即可，不要重做 |
| live settle 后助手结论跑到工具前 | OpenSpec 仍 open | 错序；重开历史又对 | 走既有 change，不要在本 plan 用 history 重排去「修」 |
| 助手双份渲染 | OpenSpec 仍 open | 乱序/重复 | 同上 |
| Shared V0 先画、projection 后 merge | OpenSpec 仍 open | 先残后重排 | 修好 B3 会减轻；不要改 V0-first 门槛 |

### 3.3 不是什么

- 不是 CSS 把气泡叠在一起
- 不是虚拟化行回收导致顺序跳
- 不是 `prepareThreadItems` 按时间戳重排（它 **不排序**，只 coalesce / 丢空 assistant / 截工具输出）

---

## 4. 修复策略

### 4.1 总原则

1. **先 A 后 B。** A 是确定性断线，修完用户立刻能翻历史。B 是多因，修错会伤 live merge。
2. **接上已有分页，不要把 80 改回全量。** 后端 `before` 和前端 `loadClaudeSession({ before })` 都已经在。缺的是幕布消费。
3. **芯片是单一入口。** 磁盘 hasMore、内存 pending、DOM 裁剪，三个来源汇总到同一个「上方还有 N 条 / 加载更早」芯片。滑顶可以自动触发同一条路径，不要再开第二条 UI。
4. **禁止按 timestamp 全局重排 `ConversationItem[]`。** OpenSpec `fix-live-settle-assistant-tool-order` 已否决。插入序 / id 稳定序是合同。
5. **先 OpenSpec 再改代码**（仓库 AGENTS.md）。建议 change-id：
   - P0：`fix-claude-history-disk-window-load-more`
   - P1：`fix-canvas-user-bubble-stack-and-merge-order`（可与 P0 分两个 change）

### 4.2 P0 — 接上 Claude 磁盘 load-more（修 Bug A）

目标：打开 >80 的 Claude 会话，顶部能继续往前翻，直到 `hasMore === false`。

建议改动面（保持小）：

1. **芯片可见条件**（`MessagesCore` 汇总计数）
   - 现有：`DOM 裁剪条数 + pendingOlderHistoryCount`
   - 加上：若 `historyWindowByThread[threadId].hasMore`，至少显示芯片（条数未知时用「加载更早」文案，或保守显示 `hasMore ? 1 : 0` 的存在性，不要假装知道磁盘剩余条数）
2. **requester 升级**（`useThreadActionsResumeThread` 里 `setOlderHistoryRequester`）
   - 仍先吐 `pendingOlderHistory`
   - pending 空且 `historyWindowByThread.hasMore` 且有 `nextCursor`：调用 `loadClaudeSession(workspacePath, sessionId, { limit: CLAUDE_UI_HISTORY_WINDOW, before: nextCursor })`
   - 解析 → `prependThreadItems` → 更新 `setThreadHistoryWindow`
   - 注意：requester 今天是同步 `boolean`。磁盘加载是 async。需要把 bridge 改成能表达「已受理、加载中」，避免连点重复请求。不要用固定 timeout 当完成。
3. **滑近顶部**
   - `handleCanvasScroll` 在 `scrollTop` 接近 0 且（pending 或 disk hasMore）时，触发与芯片同一条 `requestOlderHistory`
   - 必须带 in-flight 锁和失败可重试；失败要让芯片仍在
   - 回顶按钮可以只滚到顶（让 scroll handler 接着翻），或显式触发一次
4. **prepend 后保视口**
   - 已有 `readHistoryExpansionScrollSnapshot` / `restoreHistoryExpansionScrollPosition`。磁盘页必须走同一套，禁止 prepend 后被 follow 吸底
5. **identity / 切会话**
   - 切走要取消 in-flight；`historyWindowByThread` 已有 identity remap，保持
6. **测试**
   - loader：`limit=80` 时 meta.hasMore / nextCursor 仍写入
   - requester：pending 优先，然后才打 `before`
   - 芯片：80 条 + hasMore=true → 可见；hasMore=false 且无 pending 且 <800 → 不可见
   - 回归：`claudeHistoryLoader.test.ts`、`useThreadsReducer.history-window.test.ts`、`Messages` 历史窗相关测试
   - 新增：磁盘第二页 prepend 不丢第一页、不重复 id、cursor 前进

### 4.3 P1 — 顺序与连堆（修 Bug B）

按条做，每条单独可测：

1. **B1 空 assistant**
   - 不要无条件丢空壳
   - 保留条件（建议，实现时用测试钉死）：本 turn 仍 live/processing；或后面还有 user；或该 id 仍被 live-text channel 引用
   - 真的空、已 settle、且没有结构意义的，才丢
2. **B3 merge leftover**
   - incoming 未匹配项按其在 incoming 中的相对位置插入，或按与邻近已匹配 id 的关系插入
   - **禁止** `mergedItems.forEach leftover → push 到末尾` 作为唯一策略
   - 补测试：local 有更新尾 + incoming 是更早的 80 尾窗 → 合并后时间线仍是「旧在上、新在下」
3. **B2 optimistic 对齐**
   - 只扩现有 `normalizeComparableUserText` / 包装剥离，不要新写一套模糊匹配
   - 对不上就保留 optimistic 在原位，不要复制一份
4. **B4 首屏切片**
   - `slice(-300)` 之后用与 `resolveHistoryWindowCutIndex` 相同的 turn 回退（抽共享函数，禁止复制一份近似逻辑）

### 4.4 明确不做

- 把 `CLAUDE_UI_HISTORY_WINDOW` 改回全量 / 改成 800 当主修复
- 给 Shared / Codex 套同样的磁盘 80
- 重开 `shouldVirtualizeTimelineRows`
- 按 `timestamp` 对 items 全局 sort
- 用 history reload 去「纠正」live settle 顺序（那是另一个 change）
- 改滚动所有权状态机 / follow 模型（已有血泪：`docs/plans/2026-08-01-conversation-canvas-scroll-ownership-architecture.md`）
- 在 `AppShell` 根链挂翻页 setState
- 用固定 timeout 冒充磁盘页加载完成

---

## 5. 实施 Todo

### P0 Bug A

- [x] T0. 建 OpenSpec change（proposal / design / tasks / spec delta），change-id 建议 `fix-claude-history-disk-window-load-more`
- [x] T1. 芯片可见：`historyWindowByThread.hasMore` 参与 `visibleCollapsedHistoryItemCount` / 芯片渲染
- [x] T2. requester：pending 空之后打 `loadClaudeSession({ before })`，prepend + 更新 cursor；in-flight / 取消 / 失败可重试
- [x] T3. 滑近顶部走同一 requester；prepend 后用现有 scroll snapshot 恢复，禁止吸底
- [x] T4. 单测：80 + hasMore 出芯片；第二页 prepend；重复点击不双载；切会话取消
- [ ] T5. 手测：一条 >80 的 Claude Native 会话打开 → 顶是尾窗起点 → 有芯片或滑顶能继续往前 → 直到真正开头

### P1 Bug B

- [ ] T6. 另开 OpenSpec change（或同一 change 的 P1 tasks），不要和 T1–T5 搅在一个大 diff
- [ ] T7. 空 assistant 保留策略 + 测试（live 空壳不被 prepare 丢掉导致 user-user 相邻）
- [ ] T8. merge leftover 按相对位置插入 + 测试（迟到 80 尾窗不得 append 到最新后面）
- [ ] T9. 首屏 300 切片复用 turn 回退
- [ ] T10. optimistic 包装文案对齐（仅在有失败用例时扩）

---

## 6. 验收

### 6.1 Bug A

| 场景 | 通过标准 |
|------|----------|
| Claude 会话 item 数 ≤ 80 且磁盘 `hasMore=false` | 无芯片，滑顶无请求 |
| Claude 会话磁盘 > 80 | 打开后可见最近一段；顶部有芯片或等价「加载更早」 |
| 点芯片 / 滑到顶 | 更早一页 prepend 上来；视口不跳到底；已读位置相对稳定 |
| 连续翻到头 | `hasMore=false` 后芯片消失，不再请求 |
| 加载失败 | 芯片仍在，可再点；不丢已展示的 80 条 |
| 切到另一会话 | in-flight 作废，不串页 |
| Codex / Shared | 行为不回退（不出现新的 80 截断） |

### 6.2 Bug B

| 场景 | 通过标准 |
|------|----------|
| 连续两条真实用户提问（中间助手为空壳/live 外置） | 不得出现「两条蓝气泡中间什么都没有」的假连堆；空壳按 T7 策略处理 |
| 发送后 history hydrate | 不得长期并列 optimistic + 真实同一句 |
| local 已有新尾 + 迟到 setThreadItems(80 尾窗) | 旧消息在上，新消息在下，禁止旧页跑到最底 |
| 多工具回合 settle | 不要求本 change 修 live settle 错序；但不得因 merge 改动把它弄得更糟 |

### 6.3 命令（按改动面跑，不要拿「能编译」当完成）

```bash
# P0 最小
npx vitest run \
  src/features/threads/loaders/claudeHistoryLoader.test.ts \
  src/features/threads/hooks/useThreadsReducer.history-window.test.ts \
  src/features/threads/contracts/conversationCurtainContracts.test.ts \
  src/features/messages/orchestration/presentation/messagesHistoryWindow.test.ts

# P1 加上
npx vitest run \
  src/features/threads/hooks/threadReducerOptimisticItemMerge.user-images.test.ts \
  src/utils/threadItems.test.ts \
  src/features/threads/utils/dispatchThreadItemsProgressively.test.ts
```

若改了 `MessagesCore` 芯片/滚动，补或跑对应 `Messages*.test.tsx`。  
涉及 `src/app-shell/**` 才跑 `npm run check:app-shell:governance`（本 plan 不应改到那里）。

---

## 7. 回滚

- P0 可独立回滚：芯片不读 `hasMore`、requester 不打 `before`，回到「只显示 80、无入口」的 0.9 行为。用户可见回退，但不会比现在更坏。
- 不要用「临时把 limit 改成 null」当回滚，除非用户明确接受打开长会话卡顿。
- P1 merge 改动必须有测试锁；回滚时只回 merge / prepare，不要连带回滚 P0。

---

## 8. 基线闸门

排查当日（2026-08-18）**未跑**全量 lint / typecheck / vitest。接手者改代码前应先跑 §6.3 列出的相关测试，记下既有失败，避免把旧红当成自己引入。

UI 原型闸门：**不适用**。本 change 不改视觉语言，只接已有芯片与滚动。若把「还有 N 条」改成「加载更早」（未知剩余条数），用现有芯片样式，不要新做一套分页 UI。

---

## 9. Progress Log

| 日期 | 做了什么 | 证据 | 剩余 |
|------|----------|------|------|
| 2026-08-18 | 代码路径排查；确认 A 为 Claude 80 尾窗与幕布断线；B 为 prepare 丢空壳 + merge append leftover + optimistic 漂移 | 见 §2.4 / §3.2 文件路径 | 未 OpenSpec、未改代码、未真机 >80 Claude 手滑 |
| 2026-08-18 | 开 OpenSpec P0 change `fix-claude-history-disk-window-load-more`（proposal / design / tasks / 3 spec deltas） | `openspec/changes/fix-claude-history-disk-window-load-more/` | P0 实现未开始；P1 Bug B 另开；真机未测 |
| 2026-08-18 | 落地 P0：芯片读磁盘 `hasMore`、requester 打 `loadClaudeSession({ before })`、滑顶走同一路径、prepend 复用 expansion snapshot | vitest 13 files / 117 passed（§6.3 P0 + 新文件 + `Messages.history-window` / `Messages.history-loading` / `messagesLiveWindow`） | T5 真机 >80 Claude 手滑未做；P1 Bug B 另开；未 commit |

---

## 10. 索引与交叉引用

- 幕布结构：`docs/analysis/conversation-canvas-structure-2026-07-31.md`
- live settle 错序（不要并进本 diff）：`docs/analysis/live-settle-assistant-tool-order-2026-08-04.md`
- 滚动所有权（已下线，勿复活）：`docs/plans/2026-08-01-conversation-canvas-scroll-ownership-architecture.md`
- 0.9 changelog：`CHANGELOG.md`「会话历史窗口加大」「Claude 磁盘尾窗默认 80」
- 合同类型：`src/features/threads/contracts/conversationCurtainContracts.ts`（`historyHasMore` / `historyNextCursor`）
