## ADDED Requirements

### Requirement: Claude Native Disk Tail Window MUST Remain Consumable From The Curtain

当 Claude Native 会话按 `CLAUDE_UI_HISTORY_WINDOW`（当前 80）从磁盘加载尾窗，且 snapshot meta 声明 `historyHasMore` / `historyNextCursor` 时，系统 MUST 把该窗口状态暴露给幕布，并允许用户继续向前翻页。系统 MUST NOT 把「内存里只有尾窗」静默当成「历史已经全量」。

#### Scenario: opening a Claude session larger than the disk window shows a load-earlier entry

- **WHEN** 当前引擎为 Claude Native
- **AND** 磁盘规范化 item 数大于 `CLAUDE_UI_HISTORY_WINDOW`
- **AND** loader / resume 写入 `historyWindowByThread[threadId].hasMore === true`
- **AND** 内存 `pendingOlderHistory` 为空
- **AND** 已加载 items 未超过 DOM 历史窗
- **THEN** 幕布顶部 MUST 显示现有 collapsed-history 芯片或等价「加载更早」入口
- **AND** 系统 MUST NOT 假装知道磁盘剩余条数

#### Scenario: a short Claude session does not show a disk load-more chip

- **WHEN** 当前引擎为 Claude Native
- **AND** 磁盘规范化 item 数不超过 `CLAUDE_UI_HISTORY_WINDOW`
- **AND** `historyWindowByThread[threadId].hasMore === false`
- **AND** 无内存 pending、无 DOM 裁剪
- **THEN** 幕布 MUST NOT 显示 collapsed-history 芯片
- **AND** 滑到顶部 MUST NOT 发起 `loadClaudeSession({ before })`

#### Scenario: non-Claude engines do not inherit the Claude disk window of 80

- **WHEN** 当前会话是 Codex Native、其他 Native 或 Shared
- **THEN** 系统 MUST NOT 给这些引擎套用 Claude `CLAUDE_UI_HISTORY_WINDOW = 80`
- **AND** 它们既有的内存 pending / DOM 芯片行为 MUST 保持不变

### Requirement: Older-History Requester MUST Drain Memory Pending Before Disk Pages

幕布加载更早历史 MUST 走单一 requester。请求顺序 MUST 先吐内存 `pendingOlderHistory`，仅当 pending 为空且 `historyWindowByThread.hasMore === true` 且存在 `nextCursor` 时，才调用已有 `loadClaudeSession(workspacePath, sessionId, { limit: CLAUDE_UI_HISTORY_WINDOW, before: nextCursor })`。

#### Scenario: memory pending is consumed before any disk before request

- **WHEN** 同一 `threadId` 同时存在内存 pending 与磁盘 `hasMore`
- **AND** 用户激活芯片或 All 触发同一 requester
- **THEN** 本次请求 MUST 只 `prependThreadItems` 内存 batch
- **AND** 系统 MUST NOT 在同一次请求里调用 `loadClaudeSession({ before })`

#### Scenario: empty pending with disk cursor loads the previous disk page

- **WHEN** `pendingOlderHistory` 为空
- **AND** `historyWindowByThread[threadId].hasMore === true`
- **AND** `nextCursor` 非空
- **AND** 用户再次触发 requester
- **THEN** 系统 MUST 调用 `loadClaudeSession` 并传入当前 `before: nextCursor`
- **AND** 返回的更早 items MUST `prependThreadItems` 到现有画布之前
- **AND** reducer MUST 用新页的 `hasMore` / `nextCursor` 更新 `historyWindowByThread`
- **AND** 已展示的尾窗 items MUST 保留，不得被整表替换

#### Scenario: reaching the true start hides the disk chip

- **WHEN** 磁盘页返回 `hasMore === false`
- **AND** 内存 pending 已空
- **AND** DOM 历史窗不再裁剪
- **THEN** 芯片 MUST 消失
- **AND** 后续点击 MUST NOT 再打 `before` 请求

### Requirement: Disk Page Requests MUST Be In-Flight Locked, Cancellable, And Retryable

磁盘翻页是异步的。requester / bridge MUST 能表达「已受理、加载中」，MUST 用 in-flight 锁避免连点双载，MUST 在切会话时作废 in-flight，MUST 在失败后保留芯片并允许重试。系统 MUST NOT 用固定 timeout 冒充加载完成。

#### Scenario: repeated clicks while a disk page is in flight do not double-load

- **WHEN** 一次 `loadClaudeSession({ before })` 仍在飞行
- **AND** 用户再次点击芯片或 All 再次触发 requester
- **THEN** 第二次请求 MUST 被拒绝或合并为同一 in-flight
- **AND** 系统 MUST NOT 对同一 cursor 发出第二份磁盘请求

#### Scenario: switching threads cancels the in-flight disk page

- **WHEN** 线程 A 的磁盘翻页仍在飞行
- **AND** 用户切到线程 B
- **THEN** 线程 A 的 in-flight MUST 作废
- **AND** 迟到的 A 页 MUST NOT prepend 到 B
- **AND** MUST NOT 用 A 的 cursor 覆盖 B 的 `historyWindowByThread`

#### Scenario: a failed disk page keeps the chip and the already visible tail

- **WHEN** `loadClaudeSession({ before })` 失败或被拒绝
- **THEN** 已展示的尾窗 items MUST 保持不变
- **AND** `hasMore` MUST 保持为 true（除非权威快照证明已经到头）
- **AND** 芯片 MUST 仍然可见
- **AND** 用户再次触发 MUST 允许重试同一 cursor

### Requirement: Near-Top Scroll MUST NOT Auto-Load Older History

滑近幕布顶部 MUST NOT 触发 `requestOlderHistory`。翻页只走芯片 / All 显式点击。回顶按钮可以只滚到 `scrollTop = 0`，不得接着翻页。芯片与磁盘页仍走同一 requester，不得另开第二条加载通道。

#### Scenario: scrolling near the top does not load the next older page

- **WHEN** 幕布 `scrollTop` 接近 0
- **AND** 存在内存 pending 或磁盘 `hasMore`
- **AND** 当前没有 in-flight 磁盘页
- **THEN** 系统 MUST NOT 调用 older-history requester
- **AND** 芯片 / All 仍可显式走同一 requester

#### Scenario: scrolling near the top with nothing older does not request

- **WHEN** 幕布 `scrollTop` 接近 0
- **AND** 无内存 pending
- **AND** 磁盘 `hasMore !== true`
- **THEN** 系统 MUST NOT 调用 `loadClaudeSession({ before })`
