## Context

CodeMirror implementation is loaded behind `FileCodeMirrorEditor` 的 lazy boundary。`FileViewPanel` owns the right-click menu and持有 forwarded editor ref；当前 handle 已通过 imperative methods 暴露 find、focus 与 navigation flash。`RendererContextMenu` 支持 label/icon，但没有独立 shortcut slot。文件 tab menu 与 file editor menu 当前共用 `.fvp-tab-context-menu` class。

## Goals / Non-Goals

**Goals:**

- 让“扩大选择范围”可发现、可点击，并显示平台化快捷键。
- 保持 CodeMirror command 只存在于 lazy editor implementation。
- 只隐藏 file editor menu scrollbar chrome，保留滚动语义。

**Non-Goals:**

- 不改变 shortcut persistence/default/matching。
- 不重做 context menu keyboard navigation。
- 不全局隐藏所有 renderer context menu scrollbars。

## Decisions

### Decision 1: 通过 editor imperative handle 暴露 command

`FileCodeMirrorEditorHandle` 增加 `expandSelection(): boolean`。`FileCodeMirrorEditorImpl` 使用当前 `EditorView` 调用已安装 dependency `selectParentSyntax`，成功或失败后保持无异常 no-op；成功调用后 focus editor。

Alternatives：直接在 `FileViewPanel` import CodeMirror command 会跨越 lazy boundary；复制 syntax selection 算法会产生行为漂移，均不采用。

### Decision 2: RendererContextMenu 增加 optional shortcut presentation

leaf item 增加 optional `shortcut?: string`，渲染为独立、`aria-hidden`、右对齐的 presentation span。menu item accessible name 仍由 action label 提供，避免 screen reader 重复朗读 shortcut。

Alternative：把 shortcut 拼进 label 字符串，代码更少，但不能稳定对齐，也污染可访问名称。

### Decision 3: 复用 shared platform formatter

`FileViewPanel` 使用 `formatShortcutForPlatform(expandSelectionShortcut)`；setting 为 `null` 时省略 shortcut field，而不是显示 `Not set`。

### Decision 4: file editor menu 使用独立 modifier class

file menu 使用 `.fvp-file-context-menu`；CSS 保留 inherited `overflow-y: auto`，增加 Firefox `scrollbar-width: none` 和 WebKit `::-webkit-scrollbar { display: none; }`。tab menu 与其他 renderer menus 不受影响。

## Risks / Trade-offs

- [Risk] editor view 未就绪时产生 dead action → 仅在 `cmRef.current?.view` 存在且 edit surface 可用时组装菜单项。
- [Risk] selection 已到 syntax root 时 command 返回 false → 安静 no-op 并保持 editor focus，符合 CodeMirror command contract。
- [Risk] optional shortcut slot 改变 shared item flex layout → 使用 `margin-left: auto` 与 fixed shrink rules，并补 shared component focused test。

## Migration Plan

纯前端向后兼容变更，无数据迁移。回滚时移除 handle method、menu item、optional shortcut slot 与 scoped CSS 即可；原快捷键继续工作。

## Open Questions

无。
