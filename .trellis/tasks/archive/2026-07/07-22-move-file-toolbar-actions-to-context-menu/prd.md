# 文件工具栏动作迁移至右键菜单

## Goal

将文件 Tab 下方工具栏的命令迁移到文件内容右键菜单，并把返回按钮放到 Tab 行开头，减少长期占用的纵向空间。

## OpenSpec

- Change: `move-file-toolbar-actions-to-context-menu`

## Requirements

- 复用 `RendererContextMenu` 和 Tab 右键视觉规格。
- 提供 Cut、Copy、Paste，严格区分 edit、preview、read-only 与 selection 状态。
- 迁移 Git Blame、Canvas、definition、references、preview/edit、save actions，复用既有 handlers。
- 主窗口与 detached explorer 使用同一单行 header 行为。
- 删除旧 toolbar render，不用 CSS 假隐藏。
- 不新增 dependency，不改 backend/API/document lifecycle。

## Acceptance Criteria

- [ ] 文件内容右键菜单命令与 disabled/error 行为符合 OpenSpec。
- [ ] Back/leading action 位于 Tab 行开头，`.fvp-topbar` 不再渲染。
- [ ] Tab 菜单、dirty draft、preview/edit、detached leading action 不回归。
- [ ] 仅 focused Vitest、CSS contract、typecheck、OpenSpec strict validation 通过。

## Technical Notes

- Cut 必须先成功写 clipboard 再删除 selection。
- Preview Copy 捕获 DOM selection；非 CodeMirror editable control 保留 native context menu。
- Git Blame gutter 专用 menu 与通用 file menu 不得并存竞争。
