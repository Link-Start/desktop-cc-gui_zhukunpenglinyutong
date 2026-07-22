## Why

“扩大选择范围”目前只能通过 `Cmd+W` / `Ctrl+W` 触发，普通用户难以发现；文件右键菜单同时显示原生滚动条，遮挡内容并增加视觉噪声。

## 目标与边界

- 在可编辑文件的右键菜单中提供“扩大选择范围”，并显示当前平台的快捷键提示。
- 点击菜单项与键盘快捷键复用同一个 CodeMirror `selectParentSyntax` 行为。
- 仅隐藏文件编辑器右键菜单的 scrollbar chrome，保留滚轮、触控板与溢出滚动能力。

## 非目标

- 不改变用户配置的快捷键。
- 不修改其它 `RendererContextMenu` 实例的 scrollbar 表现。
- 不新增选择算法、依赖或 backend contract。

## What Changes

- 扩展 editor handle，向文件面板暴露 `expandSelection()`。
- 文件编辑器右键菜单新增“扩大选择范围”及平台化 shortcut hint。
- 为文件编辑器右键菜单增加独立 class，并跨 WebKit / Firefox 隐藏 scrollbar chrome。
- 增加 focused interaction、i18n 与 CSS contract tests。

## 方案对比

1. **推荐：通过 editor handle 调用现有 command**。保持 `@codemirror/*` 在现有 lazy boundary 内，菜单和快捷键共用 `selectParentSyntax`。
2. 在 `FileViewPanel` 直接 import `selectParentSyntax`。代码更短，但会把 CodeMirror state-coupled module 拉进 shell chunk，违反现有 lazy-boundary contract。
3. 在 panel 重新实现 selection range 算法。重复 CodeMirror 能力，语言边界与 overlay 行为更容易漂移，不采用。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `app-shortcuts`: 增加 editor-scoped shortcut 的右键菜单发现入口及平台化提示 contract。
- `client-scrollbar-visual-consistency`: 增加文件编辑器右键菜单隐藏 scrollbar chrome、保留滚动能力的 contract。

## Impact

- Frontend：`FileCodeMirrorEditor` handle、`FileViewPanel` command menu、`RendererContextMenu` shortcut presentation、file-view CSS 与 locales。
- Tests：focused Vitest / CSS contract。
- Dependencies / APIs：无新增依赖，无 backend 或 persistence 变更。

## 验收标准

- 可编辑文件右键菜单显示“扩大选择范围”和 `⌘W` / `Ctrl+W`。
- 点击后选择范围按 syntax parent 扩大并重新聚焦 editor。
- preview、loading 或无 editor view 时不暴露不可执行入口。
- 文件编辑器右键菜单不显示纵向 scrollbar，但仍保持 `overflow-y: auto` 与滚动能力。
- 相关 focused tests、typecheck、incremental lint 与 strict OpenSpec validation 通过。
