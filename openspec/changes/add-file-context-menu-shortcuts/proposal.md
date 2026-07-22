## Why

File Editor 右键菜单目前只有“扩大选择范围”显示快捷键，其余 action 即使已有 keyboard binding 也不可发现；部分菜单 action 还只能通过鼠标触发。需要让菜单提示与真实 keyboard behavior 共用同一 contract，并采用用户熟悉的 IntelliJ IDEA 风格。

## 目标与边界

- 为 file content context menu 的可执行 leaf action 显示 platform-aware shortcut hint。
- 保留全部现有 binding，尤其是 Expand Selection `Cmd/Ctrl+W`、Definition `Cmd/Ctrl+B`、References `Alt+F7` 与 Save `Cmd/Ctrl+S`。
- 缺失 action 采用 IDEA 风格：Implementation `Cmd/Ctrl+Alt+B`、Reveal `Alt+F1`；产品专属 action 使用 editor-scoped `Alt+Shift+字母` mnemonic。
- 菜单 hint、CodeMirror keymap 与 outer file-view listener 复用同一 shortcut definitions。

## 非目标

- 不改动任何已有快捷键及其 persisted setting。
- 不新增第三方 keybinding dependency、backend command 或 persisted settings schema。
- 不给 `Git 操作` submenu trigger 本身绑定 shortcut；只标记实际可执行 leaf。
- 不改变 action 的业务 callback、availability、disabled 状态或 repository scope。

## What Changes

- 在 file content context menu 补齐 clipboard、note capture、Git leaf、reveal、Canvas、navigation、preview/edit 与 save 的 shortcut hints。
- 为 Implementation、Reveal、Preview/Edit 及可用产品 action 注册缺失的 editor/file-view scoped bindings。
- 增加 platform formatting、实际触发、disabled/no-op 与 menu discoverability regression tests。

## 技术方案对比

1. **共享 shortcut definitions（采用）**：menu hint 与 keyboard listener/keymap 从同一常量读取，修改面集中且不会出现“显示了但按不动”。
2. **只给 menu item 写静态 shortcut text（不采用）**：diff 更小，但无法保证实际可触发，且 platform label 与 behavior 容易漂移。
3. **全部加入 Settings persistence（不采用）**：可配置性更高，但会扩大 settings/i18n/Rust schema，本需求只要求补齐常用快捷键，违反 YAGNI。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `app-shortcuts`: 扩展 File Editor context-scoped shortcut contract，同时保持现有 configurable shortcuts 不变。
- `filetree-multitab-open`: 要求 file content context menu 为可执行 leaf 显示并兑现 shortcut behavior。

## Impact

- Frontend：`src/features/files/components/FileViewPanel.tsx`、`FileCodeMirrorEditorImpl.tsx`、feature-local shortcut definitions 与 focused tests。
- Settings：不新增、不迁移、不修改 persisted shortcut key/default。
- Dependencies/API/backend：无新增依赖，无 backend/API 变更。

## 验收标准

- macOS 与 Windows/Linux 菜单显示各自 platform notation，且每个显示的 shortcut 都能触发同一 menu action。
- `Cmd/Ctrl+W`、`Cmd/Ctrl+B`、`Alt+F7` 与 `Cmd/Ctrl+S` 行为和配置保持不变。
- Implementation 使用 `Cmd/Ctrl+Alt+B`，Reveal 使用 `Alt+F1`，产品专属 action 使用一致的 `Alt+Shift+字母` mapping。
- unavailable/disabled action 不因 shortcut 被执行；preview/edit mode 切换后 shortcut hint 与 action 保持一致。
- focused Vitest、typecheck、lint 与 OpenSpec strict validation 通过。
