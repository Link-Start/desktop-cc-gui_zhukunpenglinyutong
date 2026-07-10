# IDEA-style Editable Workspace Diff

## Goal

将 live workspace Git diff 弹窗升级为固定双栏：左侧只读“上个版本”，右侧“源代码”默认可编辑，无需点击编辑按钮。

## OpenSpec

- Change: `add-idea-style-editable-workspace-diff`

## Requirements

- Git、Checkpoint、Session Activity 的 workspace text diff 使用统一双栏交互。
- 左栏从 HEAD-to-worktree unified patch 还原 baseline，并保持只读。
- 右栏复用现有 workspace file document/save contract。
- 保存后刷新 live diff 与 Git status。
- dirty 状态关闭或切换文件时必须确认。
- deleted、image、PDF、preview-only 与无法还原的 patch 保持只读 fallback。

## Acceptance Criteria

- [x] 可写文本 diff 打开后右栏可直接输入，不出现“编辑”按钮。
- [x] 左栏显示“上个版本”且不可编辑，右栏显示“源代码”。
- [x] 保存按钮和 `Ctrl/Cmd+S` 复用现有写入链路。
- [x] 保存成功刷新 diff/status，dirty close 不静默丢失。
- [x] dirty close 支持“保存并关闭 / 继续编辑 / 放弃修改”，保存失败保持弹窗与草稿。
- [x] dirty draft 经 inline preview 后重开 modal 仍恢复为可编辑双栏，不降级为只读 renderer。
- [x] 侧栏 Git 入口首次打开时等待 diff CSS ready，不出现裸 DOM 或依赖右上角 Git warm-up。
- [x] Git History 入口独立加载 shared diff CSS，worktree action buttons 与 modal 不依赖 `GitDiffPanel` warm-up。
- [x] focused tests、入口 regression tests、lint、typecheck、build、OpenSpec strict validation 通过。
- [x] 人工验证 Git diff 弹窗的实际编辑、保存和响应式布局。

## Technical Notes

- 不新增依赖或 Rust command。
- full test suite 受既有 `Sidebar.test.tsx` 3 个环境相关失败阻断；本次相关 237 tests 全部通过。
