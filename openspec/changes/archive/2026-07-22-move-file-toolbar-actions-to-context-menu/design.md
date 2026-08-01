## Context

`FileViewPanel` 当前在 file tabs 下方渲染 `.fvp-topbar`，其中左侧是返回与路径，右侧是 edit/preview、Git Blame、Intent Canvas、definition、references 和 save actions。单行 detached layout 也会把这些 actions 放在 Tab 行右端。编辑器依赖 CodeMirror，panel 已持有 `cmRef.current.view`；Tab 菜单已统一到 portal-based `RendererContextMenu`。

约束：不新增依赖；不改变 handler、document state、Tab lifecycle 与 backend contract；右键菜单不得拦截 annotation input 等独立 editable control 的原生行为；Git Blame gutter 不再产生第二份竞争菜单。

## Goals / Non-Goals

**Goals:**

- 以一个 file content context menu 收敛 clipboard 与原 toolbar commands。
- 复用 Tab 菜单的 shared renderer 与 CSS visual contract。
- 将 back action 固定在 Tab 行最左侧，移除旧 toolbar 行。
- 对 editor/preview/read-only/loading/dirty 状态给出确定的 enabled contract。
- main 与 detached layout 通过同一 render path 保持一致。

**Non-Goals:**

- 不扩展 shared menu 为通用 command framework。
- 不改变 file tab menu items 或 Tab state ownership。
- 不实现 clipboard history、rich clipboard format 或 filesystem copy/paste。
- 不修改 CodeMirror keymap、浏览器快捷键或 file save shortcut。

## Decisions

### Decision 1: `FileViewPanel` owns one file content menu

在 `.fvp-body` 上接收 `contextmenu`，过滤普通 `input/textarea/contenteditable`；CodeMirror `.cm-editor` 是显式允许的特殊目标。Panel 根据当前 mode、selection 与 capability 构造 `RendererContextMenuItem[]`，用既有 clamp helper 定位。

Alternative：在 `FileCodeMirrorEditorImpl` 新增 context-menu command layer。拒绝，因为 preview 仍需菜单，且会把 file-level Git/Canvas/save orchestration 下沉进 editor adapter。

### Decision 2: clipboard uses current surface selection

- Edit mode：从 `cmRef.current.view.state.selection.ranges` 读取 selection；Cut 在 clipboard write 成功后用 `state.replaceSelection("")` 原子删除；Paste 使用 `navigator.clipboard.readText()` 后 `state.replaceSelection(text)`。
- Preview mode：Copy 捕获 `window.getSelection()?.toString()`；Cut/Paste disabled。
- Clipboard API 缺失或 reject 时显示 localized error toast；不吞异常，不在 write 失败时删除文本。

Alternative：调用 deprecated `document.execCommand()`。拒绝，因为 paste 跨 WebView 不稳定、permission/error contract 不透明。

### Decision 3: toolbar commands reuse existing handlers

菜单项直接调用 `gitBlame.toggle`、`handleAssociateIntentCanvasCodeAnchor`、`runDefinitionFromCursor`、`runReferencesFromCursor`、`handleEnterPreview`、`handleEnterEdit` 与 `handleSave`。Loading/dirty/truncated/capability 状态映射为 label、disabled、或既有动态文案。命令逻辑不复制。

Alternative：引入 command registry。拒绝，当前只有一个消费 surface，抽象成本大于收益。

### Decision 4: header becomes one structural row

统一渲染 `.fvp-header-row`：back/leading action、tabs、dirty/truncated indicator。删除 `renderTopbar` 与 action group render；不再显示路径，因为 active tab label 与 title 已提供路径入口，且用户明确要求隐藏该 toolbar。

Alternative：只用 CSS `display:none` 隐藏旧 toolbar。拒绝，因为 hidden DOM 仍保留重复 command surface，并让测试与 accessibility tree 漂移。

### Decision 5: reuse existing visual class without changing shared UI

file content menu 使用与 Tab 菜单相同的 scoped context-menu class。`RendererContextMenu` API 不扩展，避免影响其他 callers。

## Data Flow

1. 用户在 file body 触发 `contextmenu`。
2. Handler 校验 target，读取 editor/DOM selection，构造 items 并 clamp position。
3. `RendererContextMenu` portal 渲染并负责 focus、Escape、outside click 与 close。
4. 选择 action 后调用现有 handler；clipboard action在 permission 成功后更新 CodeMirror。
5. React 从 canonical document/mode/git state 重渲染菜单之外的 UI。

## Risks / Trade-offs

- [Risk] Clipboard permission 被系统拒绝 → 捕获异常并 Toast；Cut 只在 write 成功后删除，防止数据丢失。
- [Risk] React body handler误拦截 annotation input → 对非 CodeMirror editable target 直接返回，保留 native menu。
- [Risk] Blame gutter旧菜单与新菜单竞争 → 移除专用 gutter menu state/render，把右键统一到 file content menu。
- [Risk] 菜单打开后 selection 变化 → open 时保存 preview selection；editor command 执行时读取仍由 CodeMirror state 持有的 selection。
- [Trade-off] Clipboard item 不展示 keyboard shortcut hint；保持 shared menu API 与 diff 最小。

## Migration Plan

1. 增加 i18n 与 file content menu state/actions。
2. 用单行 header 替换旧 tabs + toolbar 组合。
3. 删除 Git Blame 专用 context menu render。
4. 补 focused component 与 CSS contract tests。
5. 运行增量 Vitest、typecheck、OpenSpec strict validation。

Rollback：恢复旧 `renderTopbarActions`/`renderTopbar`、旧 Blame menu 与 conditional header；删除 file content menu 与新增文案。无数据迁移。

## Open Questions

无。用户已确认菜单范围、单行 header 和仅增量测试边界。
