# Design: fix-claude-history-disk-window-load-more

## Context

0.9 把 Claude Native 历史切成三层窗口，各自为政：

1. **磁盘尾窗** `CLAUDE_UI_HISTORY_WINDOW = 80`：loader / resume 写 `historyWindowByThread.hasMore` + `nextCursor`。后端 `limit` + `before` 与 `loadClaudeSession({ limit, before })` 已齐。
2. **内存首屏** `THREAD_ITEMS_FIRST_PAINT_COUNT = 300`：超额进 `pendingOlderHistory`，芯片点 `takeNextOlderHistoryBatch`。
3. **DOM 表现窗** `DEFAULT_HISTORY_WINDOW_SIZE = 800`：只裁 reducer 已有 items。

幕布芯片 / 滑顶只认 ②③。Claude 只进了 80 条，`80 < 300 < 800`，三层全部静默。全仓 `historyWindowByThread` 只出现在 reducer / identity remap / 测试，`src/features/messages/**` 零读取。

当前 requester 是同步 `(threadId) => boolean`，只吐内存 batch。`MessagesCore.tryLoadOlderHistoryPage` 在 `!hasPendingOlderHistory` 时直接 return，即使磁盘还有页。滑顶 `handleCanvasScroll` 只更新锚点。

约束：性能红线禁止重开时间线虚拟化、禁止逐 delta 进根 reducer、禁止在 AppShell 根链挂翻页 setState。滚动所有权状态机已下线，只复用 expansion snapshot。

## Goals / Non-Goals

**Goals:**

- 打开 >80 的 Claude Native 会话，顶部有单一「加载更早」入口。
- pending 优先，然后才打 `before`；prepend 保视口；in-flight / 取消 / 失败可重试。
- 滑顶与芯片走同一 requester。

**Non-Goals:**

- 不改 80 常量，不给 Shared / Codex 套磁盘 80。
- 不修 Bug B（空 assistant / merge leftover / optimistic / 首屏 300 切片）。
- 不按 timestamp 全局 sort；不重开虚拟化；不改 follow 模型。

## Decisions

### D1. 芯片是单一入口，磁盘 hasMore 只贡献存在性

**选择**：`visibleCollapsedHistoryItemCount` 的「是否显示」= DOM 裁剪 + pending 计数 + `hasMore`。文案：本地已知 N > 0 时沿用 `messages.showEarlierMessages`；仅磁盘 hasMore 时新增 i18n「加载更早」，不编造剩余条数。

**备选**：把 hasMore 计成 1，继续走 `Show 1 earlier messages`。否决：对用户撒谎。

**备选**：新做分页条。否决：第二套 UI。

### D2. requester 同步受理、内部异步，不把 Promise 打进 click 热路径

**选择**：保留 `requestOlderHistory(threadId): boolean` 的「是否受理」语义。

- pending 非空：同步 prepend，返回 `true`。
- pending 空且 `hasMore` + `nextCursor`：登记 in-flight，**立即**返回 `true`，再 `void` 异步 `loadClaudeSession`。成功后 `prependThreadItems` + `setThreadHistoryWindow`；失败清 in-flight，保留 hasMore。
- 已 in-flight 或无可翻：返回 `false`。

`tryLoadOlderHistoryPage` 去掉「必须有 memory pending」早退，改为「pending 或 disk hasMore」即可拍 snapshot 并调用 requester。

**备选**：把 requester 改成 `Promise<boolean>`，click await。否决：芯片 handler 会把异步态泄漏进 render；现有 restore token 已按「受理即拍 snapshot」工作，磁盘页完成后再拍一次即可。

磁盘页完成时再走一次 snapshot restore：在 dispatch prepend 前读容器 snapshot（若用户已滑走则以完成瞬间为准），与现有 `olderHistoryRestoreRef` 对齐。禁止固定 timeout。

### D3. in-flight 以 `threadId + cursor` 为键，切会话 generation 作废

**选择**：在 resume hook 闭包里用 `Map<threadId, { cursor, generation }>`。`resumeRequestGenerationByScopeRef` 已存在，迟到页必须核对 generation + threadId，对不上丢弃。

切走：generation++，清该 thread 的 in-flight。不要用全局单飞锁误伤切回来的重试。

### D4. 上翻不自动翻页（2026-08-18 用户反馈回写）

原选择是滑顶自动走芯片同一 requester。手测后：到顶自动翻页，翻完视口被钉到底，用户必须重新往上拉。

**现行选择**：`handleCanvasScroll` 只更新锚点，MUST NOT 在 `scrollTop` 接近 0 时调用 `tryLoadOlderHistoryPage`。回顶按钮只 `scrollTo({ top: 0 })`，不得接着翻页。翻页只走芯片 / All。prepend 保视口仍走 expansion snapshot；send-boundary 不得把涨 `userMessageCount` 当成新发送。

**备选**：保留滑顶自动翻、只修吸底。否决：用户明确要求上翻不自动翻页。

### D5. 不改 loader limit，只消费已有 meta

`claudeHistoryLoader` / resume 已写 `assembledSnapshot.meta.historyHasMore`。本 change 不改 Rust、不改 IPC 字段名。Shared / Codex loader 零改。

磁盘第二页 items 可能与第一页边界 id 重叠：`prependThreadItems` 必须按 id 去重，cursor 只在成功页前进。

## Risks / Trade-offs

- [Risk] 磁盘剩余条数未知，用户不知道还要翻几次 → Mitigation：存在性文案；翻到 `hasMore=false` 芯片消失。
- [Risk] 滑顶 + 点芯片双触发 → Mitigation：同一 requester + in-flight 锁。
- [Risk] prepend 后 follow 吸底 → Mitigation：点击/滑顶先 `pauseFollow`，走 expansion snapshot；禁止改 follow 状态机。
- [Risk] 切会话串页 → Mitigation：generation + threadId 校验。
- [Risk] 失败后 cursor 被清掉无法重试 → Mitigation：失败不改 `historyWindowByThread`。
- [Trade-off] 同步 boolean 无法表达「加载中」给 UI → 芯片在 hasMore 期间保持可见即可，不做独立 spinner（避免新视觉）。可选 `aria-busy`，非本 change 必须。

## Migration Plan

无需数据迁移。`historyWindowByThread` 已在写。回滚：芯片不计 hasMore；`tryLoadOlderHistoryPage` 恢复 pending 早退；requester 去掉 `before` 分支。不要用 `limit=null` 当回滚。

## Open Questions

- 滑顶阈值具体像素：实现时用 32px，测试钉「接近 0」即可，不必产品拍板。
- 是否在芯片上显示 loading：默认不显示新 UI；若手测连点困惑，再加 `aria-busy`，不加新控件。
