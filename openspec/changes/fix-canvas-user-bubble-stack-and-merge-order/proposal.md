# Proposal: fix-canvas-user-bubble-stack-and-merge-order

> OpenSpec change id: `fix-canvas-user-bubble-stack-and-merge-order`  
> Skill: `openspec-ff-change`  
> Evidence: `docs/plans/2026-08-18-conversation-curtain-history-missing-and-order.md` §3  
> Scope: **P1 Bug B only**。P0 磁盘翻页已独立落地（`fix-claude-history-disk-window-load-more`），禁止混进本 diff。

---

## Why

升级 0.9 后幕布会出现两类可同时出现、根因不同的 P1 问题：右侧用户蓝气泡连续堆叠，以及整段时间线相对位置被迟到的 `setThreadItems` 打乱。这不是 CSS 叠层，也不是虚拟化行回收。`prepareThreadItems` 会丢掉 live-text 外置后的空 assistant 壳；optimistic 与 history 包装文案对不齐会留下双份蓝气泡；merge leftover incoming 无条件 append 会把更早一轮接到最新消息后面。按 `timestamp` 全局重排会伤 live settle，必须按条修。

## What Changes

- **B1 空 assistant 保留**：`prepareThreadItems` 不得无条件丢掉「无 text / 无 images / 无 `executionTargetSnapshot`」的 assistant。本 turn 仍 live/processing、后面还有 user、或该 id 仍被 `liveAssistantTextChannel` 引用时必须保留；真的空、已 settle、且没有结构意义的才丢。
- **B3 leftover 相对插入**：`mergeThreadItemsPreservingOptimisticUsers` 不得把未匹配 incoming 一律 `push` 到末尾。未匹配项按其在 incoming 中与邻近已匹配 id 的关系插入，保持「旧在上、新在下」。
- **B3 follow-up（Grok leftover Exploring）**：incoming 完全对不上时，不得把 explore / in-progress `commandExecution` leftover 插到新 optimistic user 前面。Grok canvas 必须隐藏 latest user 之前的 orphan `exploring`，并禁止 `pickLikelyGrokSessionId` 把已被其他 mossx thread 占用的 session 绑到新 pending tab。
- **B2 optimistic 包装对齐**：只扩现有 `normalizeComparableUserText` / wrapper 剥离；先用失败用例钉漂移，对不上则保留 optimistic 在原位，禁止复制一份。
- **B4 首屏 turn 回退**：`dispatchThreadItemsProgressively` 的 `slice(-300)` 之后复用 `resolveHistoryWindowCutIndex` 同一套 turn 边界回退（抽共享函数，禁止复制一份近似逻辑）。

## 目标与边界

- **目标**：消除假 user-user 连堆；迟到 history / 80 尾窗 merge 不得把更早一轮接到最新后面；同一句 user 不得长期并列 optimistic + 权威气泡；首屏 300 不得把同一 turn 切成两半。
- **边界**：`prepareThreadItems` 空 assistant 过滤、`threadReducerOptimisticItemMerge` leftover 序、`normalizeComparableUserText` 包装剥离、`dispatchThreadItemsProgressively` 首屏切口。
- **引擎**：Native + Shared 共用 prepare / merge 路径。本 change 修共享 merge 合同，不给某一引擎单独写一套排序。

## 非目标

- 不按 `timestamp` 全局重排 `ConversationItem[]`。
- 不用 history reload 去「纠正」live settle 助手/工具顺序（`fix-live-settle-assistant-tool-order`）。
- 不重做 `fold-background-task-notification`（`<task-notification>` 假用户气泡，0.9 已修，本 change 只回归）。
- 不重开 `shouldVirtualizeTimelineRows`。
- 不改 Claude `CLAUDE_UI_HISTORY_WINDOW`、不改 Bug A 芯片 / requester / 滑顶。
- 不改滚动所有权状态机 / follow 模型。
- 不在 `AppShell` 根链挂 merge setState。
- 不把 Shared V0-first / projection 非阻塞门槛并进本 diff（`fix-shared-history-projection-nonblocking`）。
- 不修助手双份渲染（`fix-assistant-duplicate-render-native-shared`）。

## 技术方案对比

| 选项 | 做法 | 取舍 |
|------|------|------|
| **A. 按条修四条根因（采用）** | B1 保留策略 + B3 相对插入 + B2 只扩现有 normalize + B4 复用 turn 回退 | 改动面落在已有 prepare/merge/first-paint；每条单独可测；不引入全局排序 |
| B. 按 timestamp 全局 sort | merge / hydrate 后对整表按时间戳重排 | 已在 `fix-live-settle-assistant-tool-order` 否决；会打乱插入序 / id 稳定序；live 与 history 时钟不可比 |
| C. 迟到 setThreadItems 整表替换 local | incoming 覆盖 local，丢掉 optimistic / live 尾 | 连堆可能消失，但发送中气泡闪没、live 外置壳丢失；比 leftover append 更伤 |

## Capabilities

### New Capabilities

- `canvas-user-bubble-stack-and-merge-order`：幕布 user 气泡连堆与 merge 顺序合同——空 assistant 保留、leftover 相对插入、首屏 300 turn 回退。

### Modified Capabilities

- `conversation-realtime-history-parity`：User Bubble Parity 的 wrapper 剥离必须覆盖仍会漂移的 memory / note-card / agent-prompt 变体；对不上时 MUST 保留 optimistic 原位，MUST NOT 再复制一条权威气泡。

## Impact

- `src/utils/threadItems.ts`：空 assistant 过滤改为保留策略。
- `src/features/threads/hooks/threadReducerOptimisticItemMerge.ts`：leftover incoming 相对插入。
- `src/features/threads/hooks/threadReducerOptimisticUserReconciliation.ts` + `src/features/threads/assembly/conversationNormalization.ts`：只在失败用例证明后扩 `normalizeComparableUserText`。
- `src/features/threads/utils/dispatchThreadItemsProgressively.ts`：首屏切口复用 turn 回退。
- `src/features/messages/orchestration/presentation/messagesHistoryWindow.ts`：抽共享 `resolveHistoryWindowCutIndex` / turn 回退，供 first-paint 复用。
- 测试：`src/utils/threadItems.test.ts`、`threadReducerOptimisticItemMerge.user-images.test.ts`、`dispatchThreadItemsProgressively.test.ts`；按需补 merge leftover / 空壳 / wrapper 漂移用例。
- 邻近 OpenSpec **不要混进本 diff**：`fix-live-settle-assistant-tool-order`、`fix-assistant-duplicate-render-native-shared`、`fix-shared-history-projection-nonblocking`、`fold-background-task-notification`、`fix-claude-history-disk-window-load-more`。

## 验收口径

| # | 标准 | 证据 |
|---|------|------|
| B1 | 连续两条真实用户提问，中间助手为空壳 / live 外置 | 不得出现「两条蓝气泡中间什么都没有」的假连堆；空壳按保留策略留下 |
| B1b | 已 settle、无结构意义的真空间 assistant | 仍可丢掉，不制造空白卡 |
| B2 | 发送后 history hydrate，权威项带 memory / note-card / agent-prompt 包装 | 不得长期并列 optimistic + 真实同一句 |
| B2b | 两句归一化后仍不等价的真实提问 | 两条都保留，禁止因部分相似而折叠 |
| B3 | local 已有新尾 + 迟到 `setThreadItems`(80 尾窗 / projection) | 旧消息在上，新消息在下；禁止旧页跑到最底 |
| B3f | 新 tab optimistic user + 完全对不上的 explore leftover | 不得在「在吗」上方出现上一轮 Exploring / `List · Downloads`；当前轮 Exploring 仍可见 |
| B4 | 首屏 300 切口落在同 `turnId` 段中间 | 切口回退到段首；与 DOM 800 窗同一函数 |
| R | 多工具回合 settle | 不要求本 change 修 live settle 错序；不得因 merge 改动把它弄得更糟 |
