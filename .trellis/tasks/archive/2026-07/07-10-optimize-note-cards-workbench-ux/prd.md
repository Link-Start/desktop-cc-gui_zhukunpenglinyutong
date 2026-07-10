# 优化便签工作台 UX

关联 OpenSpec change：`optimize-note-cards-workbench-ux`

## 目标

- 将便签内部改为 responsive Master-Detail。
- 保护未保存草稿并明确保存状态。
- 优化 archive/delete 层级与 Undo。
- 提供便签到当前 Composer 的显式引用。
- 完善外层 separator 的持久化、键盘与复位交互。

## 边界

- 不修改 backend、storage schema、facade public contract。
- 不新增依赖与 note domain fields。
- 保留现有 `1:2` 外层布局、Markdown、图片、archive/restore/delete 能力。

## 验证

- 以 `openspec/changes/optimize-note-cards-workbench-ux/tasks.md` 和 delta spec 为验收事实源。
- 执行 focused Vitest、typecheck、lint、diff check、OpenSpec strict validation 与 desktop visual check。
