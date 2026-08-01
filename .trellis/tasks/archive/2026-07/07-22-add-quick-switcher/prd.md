# 实现 Quick Switcher

## Goal

实现 OpenSpec change `add-quick-switcher`：在 `⌘O` 搜索入口旁新增精致、无搜索框的 Quick Switcher，用于快速切换核心功能、最近会话和最近文件。

## Requirements

- desktop 使用 icon 与 `⌘E` / `Ctrl+E` 开关。
- 右侧将最近会话、最近文件独立分组，各最多 30 条，按时间倒序。
- 最近文件包含用户打开/激活与 AI completed file-change facts，持久化且按 workspace 隔离。
- 所有入口和结果行使用语义 icon，支持完整键盘和 accessibility。
- 不新增依赖，不改变 Global Search，不运行全量测试。

## Acceptance Criteria

- [x] OpenSpec `quick-context-switcher` scenarios 有对应实现或 focused tests。
- [x] 定向 Vitest、touched-file ESLint、typecheck、large-file sentry 通过。
- [x] diff 仅包含本 change 相关文件，manual visual QA 已由用户确认通过。

## Technical Notes

- OpenSpec: `openspec/changes/add-quick-switcher/`
- AI 文件事实源：`WorkspaceSessionActivityViewModel.timeline`
- 持久化：`getClientStoreSync/writeClientStoreValue`
- UI：feature-local lazy component + CSS theme tokens
