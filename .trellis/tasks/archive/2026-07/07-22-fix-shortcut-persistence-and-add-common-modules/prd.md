# 修复快捷键持久化并增加常用模块

## OpenSpec Change

`fix-shortcut-persistence-and-add-common-modules`

## Goal

修复 configurable shortcuts 在 Tauri save/echo 后被自动还原，并在快捷键设置顶部增加 12 个常用模块入口。

## Requirements

- Rust `AppSettings` 必须完整保留 frontend shortcut fields 与显式 `null`。
- 常用分组复用 shared action metadata 和 setting key。
- Git Graph、Notes、Intent Canvas、Radar、Project Map、Browser Dock、File Compare 默认不绑定快捷键，但允许用户配置。
- 新增快捷键复用现有 view handlers，并保护 editable targets。

## Acceptance Criteria

- [x] 自定义与清空快捷键经 desktop persistence round-trip 后保持。
- [x] 常用模块分组位于顶部且包含指定 12 项。
- [x] 七个新增模块快捷键触发对应现有视图。
- [x] focused tests、typecheck、lint、runtime contracts、Rust tests 和 OpenSpec strict validation 通过。

## Technical Notes

完整行为、设计与任务以 `openspec/changes/fix-shortcut-persistence-and-add-common-modules/` 为准。
