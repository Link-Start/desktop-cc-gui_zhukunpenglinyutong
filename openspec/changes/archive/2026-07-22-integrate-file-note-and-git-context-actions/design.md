## Context

`FileViewPanel` 已拥有 active file context menu、clipboard/file commands、Git scope 与 File History/Git Blame callbacks。`FileViewBody` 仍为 code selection capture 维护第二套 `RendererContextMenu` state。右键事件冒泡时两个 owner 都可能响应，造成独立 popover 叠加。

现有 `buildCodeSelectionNoteDraft` 已负责 safe fence、source line range 与 whitespace validation；现有 tab context menu 已实现 nested repository-aware `Git 操作` submenu。实现应复用两者。

## Goals / Non-Goals

**Goals:**

- 让 `FileViewPanel` 成为 file content context menu 的唯一 owner。
- 保留 CodeMirror selection 与 preview logical line selection 的 canonical capture。
- 无 selection 时用完整 canonical text snapshot 构造 capture draft。
- 复用 active file Git scope 组合 File History 与 Git Blame submenu。

**Non-Goals:**

- 不从 rendered Markdown/syntax DOM 反推 source range。
- 不直接创建 note card；仍只发送 `NoteCaptureDraft` 到 workbench。
- 不改变 Git service、note persistence 或 shared menu API。

## Decisions

### 1. `FileViewBody` 产出 selection draft，父层组合菜单

新增 feature-local callback，把原右键事件和已冻结的 `NoteCaptureDraft` 交给 `FileViewPanel`。当没有 canonical selection 时让事件自然冒泡，父层按完整文件 fallback 处理。相比保留两套 menu state 并互斥，此方案只有一个 positioning/dismiss owner。

### 2. 完整文件 capture 使用当前可见 canonical source

- edit mode：读取 CodeMirror `view.state.doc`，因此包含尚未 flush/save 的用户修改。
- source/code preview：使用当前完整 `content` snapshot。
- selection draft 优先于 whole-file draft。
- truncated、空白、skip-text/non-code surface 返回 `null`，菜单不提供虚假 capture。

继续复用 `buildCodeSelectionNoteDraft`，以 `startLine=1`、`endLine=document.lines` 表示整个文件，不新增持久化 source kind。

### 3. Git submenu 复用 tab menu scope resolver

active content 通过 `resolveTabGitScope(filePath)` 获取 repository root 与 repository-relative path。submenu leaf 根据 capability 独立出现：有 `onOpenFileHistory` 才显示 history；可用或已启用的 blame 才显示 blame。Preview 保留 read-only File History；Git Blame 只在 editor command surface 可操作。

## Risks / Trade-offs

- [Risk] preview rendered DOM selection 无可靠 source line → 仅接受既有 logical line selection，否则回退整个 source。
- [Risk] truncated content 被误称为完整文件 → truncated 时不提供 whole-file capture。
- [Risk] selection 与右键之间内容变化 → 在打开 menu 时冻结 draft，menu action 使用该 snapshot。
- [Risk] 并行 Git History change 修改同一组件 → 只做语义 patch，保留现有 `onOpenFileHistory`、tab submenu 与测试。

## Migration Plan

1. 增加 callback contract 并移除 child menu state/render。
2. 在 parent menu 组合 note item 与 Git submenu。
3. 更新 i18n 与 focused tests。
4. 若回滚，恢复 child note menu handler/render，并移除 parent note/Git composition；不涉及数据迁移。

## Open Questions

无。Markdown rendered text selection 按现有 source-aware contract 不作为行级 selection；无 logical selection 时保存完整 source。
