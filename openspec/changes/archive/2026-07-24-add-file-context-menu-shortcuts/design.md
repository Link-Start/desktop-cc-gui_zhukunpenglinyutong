## Context

`FileViewPanel` builds the file content context menu and already formats the configurable Expand Selection shortcut. `FileCodeMirrorEditorImpl` owns editor-scoped keymaps for Save、Expand Selection、Definition 与 References。当前 shortcut source 分散，Implementation 只可点击，menu 也没有展示多数既有 binding。

约束：用户明确要求采用 IntelliJ IDEA 风格，且任何已有 shortcut 均不得变化，尤其 `Cmd/Ctrl+W`。本次同时落在 menu presentation、CodeMirror keymap 与 file-view outer commands，但不应扩张 persisted settings schema。

## Goals / Non-Goals

**Goals:**

- 让每个显示 shortcut hint 的 leaf action 都能通过对应按键执行同一 callback。
- 保留既有 configurable shortcut 值与 precedence。
- 对缺失 binding 使用 IDEA mapping 或一致的 product mnemonic。
- 在 macOS 与 Windows/Linux 使用 shared formatter 生成正确 label。

**Non-Goals:**

- 不提供新的 Settings rows 或 backend persistence。
- 不给 submenu trigger、不可用 action 或只读不适用 action 注册 dead binding。
- 不改变 clipboard、Git、Canvas、note 或 navigation callback 的业务实现。

## Decisions

### Decision: Existing bindings are immutable inputs

Save、Expand Selection、Definition 与 References 继续使用当前 binding；menu 只读取并展示它们。新增 Implementation 采用 IDEA `Mod-Alt-B`，Reveal 采用 `Alt-F1`，其余 app-specific action 使用 `Alt-Shift-<mnemonic>`。

Alternative：统一改成 VS Code keymap。该方案会破坏现有用户肌肉记忆及 persisted setting，已被产品方明确否决。

### Decision: Feature-local definitions are the single source for fixed shortcuts

固定 shortcut 定义集中在 files feature 的 pure module。`FileViewPanel` 用它生成 hint 与 outer listener，`FileCodeMirrorEditorImpl` 用同一 source 注册 CodeMirror keymap。Configurable Save/Expand Selection 仍从 props/settings 读取，不复制为固定值。

Alternative：直接在每个 menu item 与 keymap 内写字符串。虽然行数少，但同一 action 会出现两个真相源，后续 drift 风险更高。

### Decision: Editor actions stay in CodeMirror; outer actions stay in FileViewPanel

Definition、Implementation、References 依赖 editor cursor，继续放在 CodeMirror `Prec.highest` keymap。Reveal、Canvas、note、preview/edit、Git leaf 由 `FileViewPanel` window listener 处理，并在 action available 时才消费事件。Clipboard 使用 CodeMirror/native binding，不增加重复 listener。

Alternative：所有 action 统一挂到 window。该方案会绕过 CodeMirror keymap precedence，并可能在 input、dialog 或 detached surface 中误触发。

### Decision: One toggle binding serves Preview and Edit

`Alt+Shift+P` 在 edit mode 进入 Preview，在 preview mode 且可编辑时返回 Edit。菜单当前 mode 只展示对应 action 与同一 hint，避免两套互相冲突的 mode shortcut。

## Risks / Trade-offs

- [Risk] outer listener 抢占普通 editable control → 使用 `isEditableShortcutTarget`，CodeMirror editor action 留在自身 keymap；outer action 仅在 file view 合法状态消费。
- [Risk] fixed binding 与用户自定义 global shortcut 冲突 → 固定 binding 仅在 File Editor surface 生效，并优先保留已有 product shortcut；不修改 Settings persistence。
- [Risk] menu hint 与 action availability 不一致 → menu 与 listener 共享同一 availability predicate/callback。
- [Trade-off] product-specific action 并非 IDEA 原生命令 → 使用统一 `Alt+Shift+字母` mnemonic，避免声称不存在的 IDEA standard。

## Migration Plan

1. 增加 feature-local fixed shortcut definitions 与 formatter coverage。
2. 接入 CodeMirror Implementation binding 与 FileViewPanel outer actions。
3. 为 menu leaf 增加 hint，并运行 focused tests、typecheck、lint。
4. 无 persisted data migration；回滚时删除新增 definitions/listener/hints，已有 bindings 完全不受影响。

## Open Questions

无。IDEA 风格与现有 shortcut 保留策略已由用户确认。
