# IDEA 风格文件右键菜单快捷键

## Goal

为 File Editor 内容右键菜单补齐真实可执行的 shortcut hints，采用 IDEA 风格并保持所有现有快捷键不变。

## OpenSpec

- Change: `add-file-context-menu-shortcuts`

## Requirements

- 保留 `Cmd/Ctrl+W` Expand Selection、`Cmd/Ctrl+B` Definition、`Alt+F7` References、configured `Cmd/Ctrl+S` Save。
- Implementation 使用 `Cmd/Ctrl+Alt+B`，Reveal 使用 `Alt+F1`。
- Preview/Edit、Canvas、Note、File History、Git Blame 使用 scoped `Alt+Shift+字母` mnemonic。
- Menu hint 与实际 keymap/listener 共用定义。
- Clipboard 显示 system shortcut；submenu trigger 不显示 dead shortcut。
- 不新增 dependency、backend API 或 persisted setting。

## Acceptance Criteria

- [ ] 每个显示 shortcut 的 leaf action 均可通过该组合键执行。
- [ ] macOS 与 Windows/Linux label 映射正确。
- [ ] unavailable/disabled action no-op，不调用 stale callback。
- [ ] 现有 shortcut 与 settings round-trip 无变化。
- [ ] Focused Vitest、typecheck、lint、OpenSpec strict validation 通过。

## Technical Notes

优先复用 `formatShortcutForPlatform`、`matchesShortcutForPlatform`、CodeMirror `Prec.highest(keymap.of(...))` 与现有 action callbacks。详细 contract 见 `openspec/changes/add-file-context-menu-shortcuts/`。
