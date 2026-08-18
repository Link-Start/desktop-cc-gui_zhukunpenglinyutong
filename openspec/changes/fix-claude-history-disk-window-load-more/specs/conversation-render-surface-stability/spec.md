## ADDED Requirements

### Requirement: Collapsed-History Chip MUST Include Claude Disk-Window Remainder

幕布 collapsed-history 芯片的可见条件 MUST 汇总三类来源：DOM 表现窗裁剪条数、内存 `pendingOlderHistory` 剩余条数、以及 Claude Native `historyWindowByThread.hasMore`。磁盘剩余条数未知时，芯片 MUST 仍可见，且 MUST NOT 用假数字冒充剩余 N。

#### Scenario: disk hasMore alone is enough to show the chip

- **WHEN** 当前 Claude Native 会话 `historyWindowByThread[threadId].hasMore === true`
- **AND** `presentationCollapsedHistoryItemCount === 0`
- **AND** `pendingOlderHistoryCount === 0`
- **THEN** 幕布 MUST 显示 collapsed-history 芯片
- **AND** 可见文案 MUST 是「加载更早」或等价存在性文案
- **AND** 系统 MUST NOT 把剩余条数渲染成一个假装精确的 N

#### Scenario: known local remainder keeps the existing counted copy

- **WHEN** DOM 裁剪条数或内存 pending 条数大于 0
- **THEN** 芯片 MUST 继续使用现有「显示之前的 N 条消息」文案
- **AND** 点击 MUST 先走内存 pending / DOM reveal，再在下一次请求里才打磁盘 `before`

#### Scenario: chip copy does not invent a disk remainder count

- **WHEN** 只有磁盘 `hasMore` 为 true，本地已知剩余为 0
- **THEN** `data-collapsed-count` MUST NOT 被写成一个声称等于磁盘剩余总量的数字
- **AND** 文案 MUST 来自 i18n，不得在生产路径硬编码中文
