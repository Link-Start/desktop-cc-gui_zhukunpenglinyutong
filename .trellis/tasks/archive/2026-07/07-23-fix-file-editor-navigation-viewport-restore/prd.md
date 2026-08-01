# 修复文件导航视口恢复

## Goal

让 File Editor semantic Back / Forward 恢复离开文件瞬间的光标位置与滚动位置，而不是只切回文件。

## OpenSpec

- Change: `fix-file-editor-navigation-viewport-restore`

## Requirements

- history snapshot 包含 `path + line + column + scrollTop`。
- semantic jump、Back、Forward 离开前刷新当前 snapshot。
- cursor focus 完成后恢复精确 scroll offset。
- 不影响 manual tab、file tree、global search、Detached Explorer 或普通 cursor movement。

## Acceptance Criteria

- [ ] Back 恢复 source file 的 non-zero cursor 与 scroll offset。
- [ ] Forward 恢复离开 target file 时的最新 cursor 与 scroll offset。
- [ ] branch truncation 与 manual navigation isolation 保持正确。
- [ ] focused Vitest、typecheck、lint、review、OpenSpec strict validation 通过。

## Technical Notes

采用 feature-local pending viewport restore，在现有 CodeMirror focus success boundary 执行，不扩张 app-shell open-file contract。共享工作区当前另有 `add-file-context-menu-shortcuts` task；禁止覆盖其 shortcut/keymap/UI 改动。
