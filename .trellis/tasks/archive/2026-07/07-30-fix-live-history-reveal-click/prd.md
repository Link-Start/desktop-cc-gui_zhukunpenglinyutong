# Fix Live History Reveal Click

## Goal

修复 live streaming 长会话中“显示之前 N 条消息”点击后无视觉与数据变化的问题。

## Requirements

- `showAllHistoryItems=true` 时停止 live tail working-set trimming。
- 未展开 live history 继续保持 bounded working set。
- 不修改 UI copy、scroll contract、runtime 或 storage。

## Acceptance Criteria

- [ ] live streaming 中点击 collapsed history indicator 后完整历史可见。
- [ ] indicator 在展开后消失。
- [ ] collapsed streaming 性能窗口契约保持不变。
- [ ] targeted tests、typecheck、OpenSpec validation 通过。

## Technical Notes

OpenSpec change: `fix-live-history-reveal-click`

根因位于 `buildLiveTailWorkingSet()`：2026-07-07 的性能修改移除了 `showAllHistoryItems` 的短路条件，但组件仍把 indicator 暴露为可点击入口。
