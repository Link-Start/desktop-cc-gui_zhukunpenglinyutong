## ADDED Requirements

### Requirement: Claude Disk Page Prepend MUST Reuse Existing History Expansion Scroll Restoration

从磁盘 `before` 页 prepend 更早 items 时，系统 MUST 复用已有 `readHistoryExpansionScrollSnapshot` / `restoreHistoryExpansionScrollPosition`（或芯片点击已走的同一套 snapshot → `useLayoutEffect` 恢复），MUST NOT 在 prepend 后被 follow 吸到底部，MUST NOT 另写一套滚动补偿。

#### Scenario: disk page prepend keeps the current reading slice stable

- **WHEN** 用户通过芯片或 All 加载 Claude 磁盘上一页
- **AND** 更早 items 被 `prependThreadItems` 插入当前历史窗上方
- **THEN** 系统 MUST 在插入后按 scrollHeight 增量恢复 `scrollTop`
- **AND** 插入前正在阅读的内容 MUST 仍留在大约同一视口区域
- **AND** 系统 MUST NOT 把视口重置到新插入块的顶部
- **AND** 系统 MUST NOT 因为 prepend 触发 follow 吸底

#### Scenario: disk page restore does not invent a new scroll ownership model

- **WHEN** 磁盘页 prepend 需要保视口
- **THEN** 实现 MUST 复用现有 history-expansion snapshot API
- **AND** 系统 MUST NOT 重开已下线的滚动所有权状态机
- **AND** 系统 MUST NOT 新增 Tauri command 或新的 history loader payload 字段；只消费已有 `hasMore` / `nextCursor`
