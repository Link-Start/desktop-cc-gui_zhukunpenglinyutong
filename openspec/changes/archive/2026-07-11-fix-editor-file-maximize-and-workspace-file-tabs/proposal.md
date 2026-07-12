## Why

打开文件后的 editor 最大化没有真正占满中间区域：composer 仍作为 main-level bottom row 参与布局，导致底部残留和遮挡观感。多 workspace 并行办公时，file tabs 只存在全局内存里，切换 workspace 后无法恢复该 workspace 已打开的文件列表。

## 目标与边界

- 让 desktop editor 最大化语义成为“中间文件区域独占”，而不是“隐藏 companion 但保留底部 composer”。
- 让每个 workspace 持有自己的 file tab memory，切回 workspace 时恢复 open tabs 与 active file。
- 只修改 desktop editor/file tab 行为；不改变 phone/tablet 布局、不改 detached file explorer、不改 backend file IO。

## 非目标

- 不引入跨重启持久化 file tabs。
- 不重构整体 app shell 或 composer 状态管理。
- 不改变文件读写、Markdown/PDF 渲染能力与外部文件监控协议。

## What Changes

- Desktop editor maximized mode hides the main-level composer and lets the editor content layer own the full center content area.
- Workspace file tabs become workspace-scoped in memory, so switching away and back restores that workspace's tabs.
- Closing all tabs or exiting editor only clears the current workspace's file tab memory.
- Focused tests cover maximized layout and workspace-scoped tab restoration.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `desktop-editor-split-layout`: maximized desktop editor must not keep an outer composer that reduces the editor center area.
- `filetree-multitab-open`: file tabs must be remembered per workspace during the current app session.

## 技术方案对比

| Option | 方案 | 取舍 |
|---|---|---|
| A | 在 CSS 中强行让 `.content` 覆盖 composer 区域 | 改动小但语义错，composer 仍 mounted 且可能继续参与 focus/interaction |
| B | 在 `DesktopLayout` 根据 `isEditorFileMaximized` 不渲染 outer composer | 语义正确，影响面局限在 desktop layout |
| C | 将 file tab memory 持久化到 client store | 可跨重启恢复，但超出当前诉求且增加迁移/sanitize 成本 |
| D | 在 `useGitPanelController` 内维护 workspace-scoped in-memory map | 满足切换项目恢复，最小改动，不引入持久化复杂度 |

采用 B + D。

## 验收标准

- Desktop editor maximized 时 `.content` 进入 `is-editor-file-maximized`，main-level composer 不渲染。
- Horizontal editor split 非最大化仍把 composer 放在 chat companion column。
- Normal chat/diff 模式 composer placement 不变。
- Workspace A 打开多个文件后切到 Workspace B，再切回 A，A 的 open tabs 与 active file 自动恢复。

## Impact

- Frontend layout: `src/features/layout/components/DesktopLayout.tsx`
- Frontend state: `src/features/app/hooks/useGitPanelController.ts`
- Tests: `DesktopLayout.test.tsx`, `useGitPanelController.test.tsx`
- Specs: `desktop-editor-split-layout`, `filetree-multitab-open`
