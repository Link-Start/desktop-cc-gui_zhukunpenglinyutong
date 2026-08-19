# Proposal: fix-claude-history-disk-window-load-more

> OpenSpec change id: `fix-claude-history-disk-window-load-more`  
> Skill: `openspec-ff-change`  
> Evidence: `docs/plans/2026-08-18-conversation-curtain-history-missing-and-order.md` §2  
> Scope: **P0 Bug A only**。P1 顺序/连堆走独立 change，禁止混进本 diff。

---

## Why

0.9 给 Claude Native 加了磁盘尾窗 80（`CLAUDE_UI_HISTORY_WINDOW`），并把 `hasMore` / `nextCursor` 写入 `historyWindowByThread`；幕布芯片、滑顶、回顶从不读这个字段，也从不调用已存在的 `loadClaudeSession({ before })`。打开 >80 条的 Claude 历史时，顶部就是尾窗第一条，没有「加载更早」入口，历史被静默截断。

这是确定性断线，不是渲染藏顶、不是虚拟化、不是字段名 camelCase 挂掉。后端分页与 IPC 已齐，缺的是幕布消费。

## What Changes

- 芯片可见条件加上 `historyWindowByThread[threadId].hasMore`。磁盘剩余条数未知时不假装知道 N，用存在性文案（「加载更早」）或保守计数，复用现有芯片样式。
- older-history requester 在内存 `pendingOlderHistory` 耗尽后，按 `nextCursor` 打 `loadClaudeSession({ limit: 80, before })`，`prependThreadItems` + 更新 `setThreadHistoryWindow`。
- requester 从同步 `boolean` 升级为可表达「已受理 / 加载中」的 bridge，带 in-flight 锁；失败可重试；切会话取消。禁止固定 timeout 当完成。
- 滑近顶部走**同一条** requester，不另开第二条 UI。prepend 后走现有 `readHistoryExpansionScrollSnapshot` / `restoreHistoryExpansionScrollPosition`，禁止 follow 吸底。
- 不改 `CLAUDE_UI_HISTORY_WINDOW` 常量，不给 Shared / Codex 套同样的磁盘 80。

## 目标与边界

- **目标**：打开磁盘规范化 item 数 >80 的 Claude Native 会话，顶部能继续往前翻，直到 `hasMore === false`。
- **边界**：`historyWindowByThread` 消费面、`setOlderHistoryRequester`、`MessagesCore` 芯片计数 / 滑顶、`loadClaudeSession({ before })`、`prependThreadItems`、现有 scroll snapshot。
- **引擎**：只修 Claude Native（`threadId` 以 `claude:` 开头）。Codex / Shared / 其他 Native 不得出现新的 80 截断。

## 非目标

- 不把 `CLAUDE_UI_HISTORY_WINDOW` 改回全量 / 改成 800 当主修复。
- 不修 Bug B（空 assistant 丢弃、optimistic 对齐、merge leftover append、首屏 300 裸切片）。另开 `fix-canvas-user-bubble-stack-and-merge-order`。
- 不按 `timestamp` 全局重排 `ConversationItem[]`。
- 不重开 `shouldVirtualizeTimelineRows`。
- 不改滚动所有权状态机 / follow 模型。
- 不在 `AppShell` 根链挂翻页 setState。
- 不用 history reload 去「纠正」live settle 顺序（`fix-live-settle-assistant-tool-order`）。
- 不新增 Tauri command / 不改 Rust `has_more` 协议（已齐）。

## 技术方案对比

| 选项 | 做法 | 取舍 |
|------|------|------|
| **A. 接上已有分页（采用）** | 芯片读 `hasMore`；requester pending 空后打 `before`；滑顶复用同一路径 | 改动面小；后端 / IPC 已齐；80 尾窗性能意图保留 |
| B. 把 80 改回全量 | `limit: null` 一次拉完整 JSONL | 打开长会话卡顿回 0.9 前；浪费已落地的 `before` API；plan 明确否决 |
| C. 新做独立分页 UI | 顶部页码 / 无限滚动独立组件 | 第二套入口；违反「芯片是单一入口」；视觉闸门不适用本 change |

## Capabilities

### New Capabilities

- `claude-history-disk-window-load-more`：Claude Native 磁盘尾窗的幕布消费合同——芯片可见、requester 分页、in-flight / 取消 / 失败、滑顶同一路径。

### Modified Capabilities

- `conversation-render-surface-stability`：collapsed-history 芯片计数必须纳入磁盘 `hasMore` 存在性，不能只认 DOM 裁剪 + 内存 pending。
- `conversation-history-expansion-scroll-restoration`：磁盘页 prepend 必须走同一套 viewport snapshot restore；允许消费已有 `hasMore` / `nextCursor`，仍不新增 Tauri command。

## Impact

- `src/features/messages/components/MessagesCore.tsx`：芯片计数、滑顶触发。
- `src/features/threads/hooks/useThreadActionsResumeThread.ts`：`setOlderHistoryRequester` 升级为磁盘 `before`。
- `src/features/threads/hooks/olderHistoryRequestBridge.ts`：同步 boolean → 可表达 in-flight。
- `src/features/threads/hooks/useThreadsReducer.ts`：已有 `setThreadHistoryWindow` / `prependThreadItems`，只消费不平行新通道。
- `src/services/tauri/session.ts`：`loadClaudeSession({ limit, before })` 已存在，本 change 只接线。
- 测试：`claudeHistoryLoader.test.ts`、`useThreadsReducer.history-window.test.ts`、`conversationCurtainContracts.test.ts`、`messagesHistoryWindow.test.ts`，以及 requester / 芯片新增用例。
- 邻近 OpenSpec **不要混进本 diff**：`fix-live-settle-assistant-tool-order`、`fix-assistant-duplicate-render-native-shared`、`fix-shared-history-projection-nonblocking`。

## 验收口径

| # | 标准 | 证据 |
|---|------|------|
| A | item ≤80 且 `hasMore=false`：无芯片，滑顶无请求 | 芯片计数单测 |
| B | 磁盘 >80：打开后可见最近一段；顶部有芯片或「加载更早」 | Messages 芯片单测 |
| C | 点芯片 / 滑到顶：更早一页 prepend；视口不跳到底 | requester + scroll snapshot 单测 |
| D | 连续翻到头：`hasMore=false` 后芯片消失，不再请求 | requester 单测 |
| E | 加载失败：芯片仍在，可再点；已展示 80 条不丢 | requester 失败路径 |
| F | 切会话：in-flight 作废，不串页 | 取消单测 |
| G | Codex / Shared 不出现新的 80 截断 | 引擎边界单测 / 不改它们的 loader limit |
| H | 手测一条 >80 的 Claude Native 会话 | **本机未测**（plan 要求真机手滑） |

## 风险与回滚

- 磁盘剩余条数未知：芯片不得显示假 N；文案走「加载更早」。
- 连点 / 滑顶连发：in-flight 锁，失败才放行。
- 回滚：芯片不读 `hasMore`、requester 不打 `before`，回到「只显示 80、无入口」。不要用「临时 `limit=null`」当回滚。
