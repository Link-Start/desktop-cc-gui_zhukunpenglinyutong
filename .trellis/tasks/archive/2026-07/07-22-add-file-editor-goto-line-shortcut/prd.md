# OpenSpec add-file-editor-goto-line-shortcut

## Goal

实现 `openspec/changes/add-file-editor-goto-line-shortcut`：在文件编辑器内使用 `Cmd+G` / `Ctrl+G` 唤起居中行列跳转 modal。

## Requirements

- editor-scoped `Mod+G`，不影响 global shortcuts。
- 支持 1-based `line` 与 `line:column`。
- 支持确认、取消、Enter、Escape、非法输入反馈和越界 clamp。
- 文案使用 i18n，样式兼容主题并满足 dialog accessibility。
- modal 压缩间距并增加行列语义 icon，保持 keyboard/accessibility contract。
- tab strip 隐藏 horizontal scrollbar 但保留横向滚动；tab 与文件树复用同一 icon resolver。
- 不新增依赖，不修改 backend/persistence。

## Acceptance Criteria

- [ ] macOS `Cmd+G`、Windows/Linux `Ctrl+G` 可打开 modal。
- [ ] 行号与行列输入可正确居中定位。
- [ ] 非法输入不移动光标；取消不产生副作用。
- [ ] modal 视觉更紧凑且包含 decorative icon。
- [ ] tab strip 无可见 scrollbar，文件 tab icon 与文件树一一对应。
- [ ] focused tests、typecheck、targeted lint 与 OpenSpec strict validation 通过；不运行 full test suite。

## Technical Notes

复用 `focusEditorViewAtLocation`；modal state 保持在 lazy-loaded `FileCodeMirrorEditorImpl` 内，避免扩大 CodeMirror runtime boundary。
