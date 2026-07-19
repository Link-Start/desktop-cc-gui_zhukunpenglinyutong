## Context

`WorkspaceNoteCardPanel` 当前同时承担 list query、detail loading、create/update form、archive/restore/delete 与 Composer reference。没有 selected note 时，右侧仍默认渲染 quick-create inputs；选择 active note 后直接进入 editable form。这个模型把浏览、创建和编辑压进同一个隐式状态，导致默认界面噪声大，也让从外部 surface 注入草稿时缺少稳定入口。

代码 surface 已有两套可靠 selection fact：

- CodeMirror edit mode：`EditorView.state.selection.main` 与 document positions；
- code preview mode：`previewLineSelection` 与 canonical `documentSnapshot/lines`。

conversation surface 已消费 normalized `ConversationItem`，同时 `Messages` 自己持有 canvas root ref、canonical items、thread/workspace identity 与 selection-freeze contract。项目另有 `buildThreadTranscript`，但它用于完整 copy，会包含 reasoning/tool 等内容，不能直接作为 semantic note export。

约束：

- capture 是低频 user action，不能把 per-selection/per-stream setState 接到 AppShell root。
- 不得把 live assistant delta 恢复到 root reducer，也不得从 DOM 拼装 whole-thread transcript。
- 不能破坏 Markdown file-link context menu、浏览器文本 selection/copy、CodeMirror annotation 或 note dirty-draft guard。
- note JSON 是本地长期数据，新增字段必须支持旧 document 缺失。

## Goals / Non-Goals

**Goals:**

- 三类 source adapter 生成同一 `NoteCaptureDraft`。
- capture 打开现有 notes workbench creating state，不直接写磁盘。
- whole-thread capture 使用 canonical semantic serializer。
- note document 可选持久化 structured source metadata。
- workbench 明确区分 idle、viewing、creating、editing、archived-preview。
- code source summary 可通过现有 editor navigation 打开文件并恢复采集行范围。
- fenced code 复用现有 Markdown message renderer，source metadata 与正文各司其职。
- 保持旧 note、现有 CRUD、attachments、query、archive、Composer reference 与 annotation contract。

**Non-Goals:**

- folder/tag/sort/autosave 与独立代码笔记模块。
- raw transcript/debug/tool/reasoning export。
- conversation source 的精确 backlink navigation；当前没有稳定的 message anchor reopen contract。
- 新 dependency、数据库或 storage migration command。

## Decisions

### 1. 使用 feature-local `NoteCaptureDraft`

新增 note-card feature contract：

```ts
type NoteCaptureDraft = {
  title: string;
  bodyMarkdown: string;
  source: WorkspaceNoteCardSource;
};
```

source 使用 discriminated union：

```ts
type WorkspaceNoteCardSource =
  | {
      kind: "codeSelection";
      path: string;
      startLine: number;
      endLine: number;
      language?: string | null;
    }
  | {
      kind: "conversationSelection";
      threadId: string;
      itemIds: string[];
    }
  | {
      kind: "conversationThread";
      threadId: string;
      itemCount: number;
      capturedAt: number;
    };
```

`bodyMarkdown` 是 capture 时的 durable snapshot；source 只保存 attribution，不重复正文。

Alternative：各入口直接构造 `noteCardCreate` payload。放弃原因是会复制 title/body/source mapping，绕过 workbench confirmation 与 draft recovery。

### 2. capture request 由现有 layout owner 低频路由

`useAppShellLayoutNodesSection` 已拥有 notes center navigation 与 focus request，因此新增 monotonic `WorkspaceNoteCaptureRequest`：

```text
FileView / Messages
  -> onCaptureNote(draft)
  -> layout owner stores one low-frequency request
  -> set centerMode/filePanelMode = notes
  -> WorkspaceNoteCardPanel consumes request
  -> creating state
```

request 被处理或用户拒绝覆盖 dirty draft 后显式 consume，避免 remount 重放。selection tracking 与 context-menu position 留在各自 local component，不提升到 root。

Alternative：全局 CustomEvent。放弃原因是已有 typed layout owner，事件会弱化 ownership 与测试可见性。

### 3. semantic transcript 是现有 thread text utility 的显式 policy

保留 `buildThreadTranscript()` 的 full-copy behavior，新增 pure semantic formatter，例如 `buildSemanticThreadNote()`：

- include canonical `message` rows：
  - user-authored visible text；
  - finalized assistant text；
- include completed `diff` 与 completed `review` 作为最终结果；
- exclude `reasoning`、`explore`、`tool`、processing/degraded generated images、control/presentation rows；
- strip 已有 injected context wrapper 使用现有 message presentation/normalization helper，不在 capture path 发明 raw marker parser；
- exclude 当前 active non-final assistant row，whole-thread snapshot 不读取 `liveAssistantTextChannel`；
- 返回 Markdown 与 included item ids/count，便于 source attribution 与 tests。

局部 conversation selection 是显式用户选择，按 DOM `Selection.toString()` 捕获；item ids 从包含 selection ranges 的 `[data-message-anchor-id]` ancestors 收集。跨多条 message 的 selection 可以保留多个 ids，但 selection 必须完全位于当前 canvas。

Alternative：复用现有 full `buildThreadTranscript` 后正则删除块。放弃原因是 reasoning/tool formatter 已丢失结构边界，后置正则不可靠。

### 4. code capture 复用现有 editor/preview selection facts

- edit mode 从 `cmRef.current?.view.state.selection.main` 读取非空 range、doc slice 与 `doc.lineAt()` line numbers。
- preview mode 从 `previewLineSelection` 和 canonical lines/document snapshot 读取完整行文本。
- body 使用 fenced code block；fence 长度根据内容中 backtick run 安全选择，language 复用现有 preview language/path inference。
- context menu local state 复用 `RendererContextMenu`。
- 不改变 annotation selection/state；annotation toolbar 和 note capture menu 可并存。

右键没有有效 code selection 时不显示 note capture action，避免把 cursor line 或整个文件作为隐式选择。

### 5. conversation context menu 保护既有交互

- selection 有效且完全位于 canvas：提供 Copy、保存选中文本到便签、保存整段对话到便签。
- 无 selection：只提供保存整段对话到便签。
- event 已 `defaultPrevented`、来自 interactive control、file link/menu trigger 或现有 custom context-menu owner 时，conversation capture 不接管。
- menu 打开前同步 snapshot selection text/item ids；menu click 后 selection 消失也不影响 draft。
- Copy 复用 clipboard helper/fallback；不移除平台原有复制能力。

### 6. note source 是 additive JSON field

Rust `WorkspaceNoteCard` 新增：

```rust
pub source: Option<WorkspaceNoteCardSource>
```

`CreateWorkspaceNoteCardInput` 接收 optional source；update 不暴露 source patch，普通编辑不会改变 attribution。Serde 对缺失 `Option` 解为 `None`，因此旧 JSON 无迁移。list summary 不复制完整 source，detail `get` 返回即可，避免 list payload 膨胀。

Source validation：

- path/thread id trim 后必须非空；
- code range 必须 `startLine >= 1 && endLine >= startLine`；
- conversation item ids 去空、去重、有界；
- thread item count/capturedAt sanitize 为非负值。

无效 source 使 create 明确失败，不静默降级为伪 attribution；普通无 source note 仍合法。

### 7. workbench 使用显式状态机而非“selectedId 是否为空”

```text
idle
  -> select active note -> viewing
  -> new/capture -> creating

viewing
  -> edit -> editing
  -> archive -> idle

creating/editing
  -> save -> viewing
  -> cancel -> previous viewing or idle
  -> navigation -> shared dirty guard

archive collection
  -> select -> archived-preview
  -> restore -> active viewing
```

布局采用 Focused Master-Detail：

- header：title、search、refresh、primary new action；
- left rail：active/archive switch + stable searchable list；
- detail：read-only title/source/meta/Markdown/attachments/actions；
- create/edit：在 detail pane 原位替换为 inputs，底部稳定 action bar；
- idle：轻量 empty guidance，不渲染 form controls。

不增加 card-in-card 装饰；storage path 从长期 header copy 收进 info/title surface。row destructive actions 保留在 overflow，hover/selected 时可见。

### 8. capture 与 dirty draft 的冲突必须显式解决

当 panel 已有 dirty creating/editing draft，新的 capture request 复用现有 discard confirm：

- 用户确认：替换为 capture draft；
- 用户取消：保留原 draft，consume 当前 capture request；
- 不允许 effect cleanup 或 query refresh静默覆盖。

capture save failure 保留 prefilled body/source，允许 retry。

### 9. code source navigation 复用现有 editor contract

`WorkspaceNoteCardPanel` 只暴露 typed `onOpenCodeSource` callback，不直接依赖 AppShell/editor controller。layout owner 将 `codeSelection` source 映射为一次 typed editor navigation：

```text
onOpenFile(path, {
  line: startLine,
  endLine,
  column: 1,
  scrollPosition: "center"
})
```

`endLine` 是 additive optional navigation field；普通 navigation 不传时继续保持 single-cursor behavior。Editor 只在目标文件加载完成且 CodeMirror view 可用后，同一 transaction 设置 start anchor、end-line head 与 centered scroll，再由现有 selection update path 发布 active line range，避免 file-change reset 清除提前写入的 range state。若文件内容缩短但 start line 仍存在，end line clamp 到当前文档末行；若 start line 已不存在，沿用现有无效定位降级。

source action 使用原生 `button` 语义与 visible link affordance，支持 keyboard activation。只有 `codeSelection` 可点击；conversation source 继续显示只读 summary，避免暗示不存在的导航能力。文件已删除、移动或不可读时，沿用现有 editor open error path，不在 note feature 复制 filesystem preflight。

Alternative：在 note panel 内直接读取文件或构造 Tauri command。放弃原因是会跨越 feature ownership，并复制 editor 已有的 file resolution/error handling。

### 10. code preview 复用现有 Markdown message renderer

只读 detail 的 `Markdown` 启用 `codeBlockStyle="message"` 并传入 `workspaceId`，复用已有 syntax highlighting、language badge、line numbers 与 copy action，不引入新的 highlighter/dependency。

新 code capture 的 `bodyMarkdown` 仅包含 safe fenced code：

~~~~text
```language
selected code
```
~~~~

path、line range、language 已存在 structured source；不再把它们重复写入 body。历史 note body 按原值渲染，不执行 migration 或 load-time rewrite，避免用户内容被静默修改。

### 11. workbench maximize 由 Desktop layout owner 控制

“最大化”是中央 workspace layout state，不是 native window maximize，也不是 note detail editor 的局部放大。`DesktopLayout` 作为 conversation/note split 的 owner，持有 transient `isNoteCardsMaximized`；`WorkspaceNoteCardPanel` 通过 feature-local layout context 只消费 `isMaximized` 与 `onToggleMaximized`，不直接查询或修改 sibling DOM。

```text
WorkspaceNoteCardPanel header action
  -> WorkspaceNoteCardsLayoutContext.onToggleMaximized()
  -> DesktopLayout toggles isNoteCardsMaximized
  -> content.is-note-cards-maximized
     note layer: full central width
     conversation companion: hidden + aria-hidden + inert
     split divider: hidden
     right panel / main topbar: unchanged
```

使用 context 是因为 `noteCardsPanelNode` 已由 `useLayoutNodes` 构造并以 opaque `ReactNode` 传入 `DesktopLayout`。它避免沿 AppShell render plumbing 增加一组纯 layout props，也避免 `cloneElement` 对 `Profiler`/provider wrapper 的脆弱假设。provider 缺失时 maximize action 不渲染，使组件在 focused test 或其他 host 中保持向后兼容。

最大化不持久化：离开 `centerMode === "notes"` 后自动 reset，避免再次进入便签池时产生 surprise state。原 `--note-cards-split-ratio` 与 client storage 不改写；还原后继续使用进入最大化前的 ratio。conversation subtree 只隐藏，不卸载，因此 thread/composer state 不丢失；同时 layout 的 interactive calculation 必须将其设为 `aria-hidden` 与 `inert`，防止键盘焦点落入被遮住的幕布。

Alternative A：在 note panel 内写 `document.body` class 或查询 parent/sibling。放弃原因是隐式 DOM coupling、cleanup 风险与 accessibility state 漂移。

Alternative B：使用 Portal/modal 覆盖整个应用。放弃原因是会遮住 right panel/main topbar，与本次“只覆盖左侧对话幕布”的范围不符。

### 12. source-origin file navigation 复用 Editor companion state

当前 `handleOpenFile()` 会统一进入 `centerMode === "editor"`，而 note panel 只在 `centerMode === "notes"` 构造，因此 source link 虽能正确定位文件，却会卸载 workbench 并恢复 conversation companion，破坏“阅读便签 ↔ 核对源码”的连续性。

采用现有 `EditorSplitCompanion` 增加 `"notes"` variant，只由 saved code source action 显式请求：

```text
saved code note source action
  -> onOpenFile(path, { line, endLine, ... }, { editorSplitCompanion: "notes" })
  -> centerMode = editor
  -> target file loaded
  -> CodeMirror restores captured range
  -> notes companion (left) + editor (center) + right panel
```

`WorkspaceNoteCardPanel` 在 notes center 与 notes companion 之间保持 mounted，selected note、query、list scroll 与 draft state 不因 source navigation 重建。layout context 增加 `canMaximize` capability：只有 notes center 可以最大化；Editor companion 中继续提供 context 以保持 component identity，但不显示不可执行的 maximize action。进入 Editor 会 reset 之前的 transient note maximize state。

关闭最后一个 file tab、退出 Editor 或 workspace file-state settlement 时，根据 companion 解析返回目标：`notes -> notes`、`projectMap -> projectMap`、`chat -> chat`。普通 file tree、global search、Markdown file link 与 Git navigation 没有传 `"notes"`，继续使用既有 companion，因此本 follow-up 不全局改变 file-open semantics。

Alternative A：让所有文件打开都保留 notes。放弃原因是会改变无关入口和用户既有 conversation workflow。

Alternative B：复制一个只读 note summary 到 Editor sidebar。放弃原因是会产生第二套 detail surface、丢失 workbench state，并增加同步漂移。

## Risks / Trade-offs

- [Risk] conversation root context menu 可能抢占 Markdown file-link 或 action card menu。→ 仅处理未被阻止、非 interactive owner 的 event，并补 file-link regression test。
- [Risk] DOM selection 跨 virtualization boundary 时 item attribution 不完整。→ 正文以用户 selection 为真，item ids 只记录实际 range ancestors；不伪造完整范围。
- [Risk] whole-thread semantic rules与 visible message normalization漂移。→ formatter consume normalized `ConversationItem` 和既有 visible-text helper，建立 pure focused tests。
- [Risk] CodeMirror lazy boundary 被 state-coupled extension 穿透。→ 不新增 extension；只通过既有 `cmRef.current.view` 在 user context-menu event 读取 selection。
- [Risk] optional source 扩展破坏旧 JSON。→ Rust tests直接读取缺失 source fixture，并覆盖 create/get/update/archive/restore。
- [Risk] workbench refactor 回归 attachment/reference/archive actions。→ 保留 facade/commands，状态重排配 focused behavior regression suite。
- [Risk] source file 已移动或删除。→ 复用 editor open error path，note 保持可读，不清理 attribution。
- [Risk] message code styles 泄漏或 note 样式复制漂移。→ 复用 `codeBlockStyle="message"` 的既有 DOM contract，并用 note-scoped wrapper 做最小布局隔离。
- [Risk] 最大化只做视觉隐藏时，conversation 仍可被 keyboard focus 或 screen reader 访问。→ `DesktopLayout` 同步更新 active class、`aria-hidden` 与 `inert`，并复用既有 focus blur effect。
- [Risk] 最大化切换覆盖用户保存的 split ratio。→ maximize 只切换 transient class，不调用 ratio persistence；restore 继续使用原 CSS variable/ref。
- [Risk] 普通 file-open 被意外继承 notes companion。→ 只有 saved source action 显式传 `"notes"`；其他 caller 的 default 继续是 `"chat"`，并补 controller/layout compatibility tests。
- [Trade-off] code source 具备稳定 path/line contract，因此本轮支持精确导航；conversation source 缺少等价 reopen contract，仍保持只读 summary。

## Migration Plan

1. 先落 optional source contract 与 backward-compatibility tests。
2. 增加 pure capture builders/semantic serializer tests。
3. 接入 layout request 与 workbench explicit states。
4. 接入 FileView/Messages local context menus。
5. 接入 code source navigation 与 shared Markdown code renderer。
6. 接入 Desktop layout-level workbench maximize/restore 与 accessibility state。
7. 接入 source-origin notes Editor companion 与 state-preserving return path。
8. 完成 i18n/styles/focused regression、typecheck、Rust tests 与 OpenSpec verify。

Rollback：

- 移除 capture callbacks/request 和 workbench state diff即可恢复原入口；
- Rust/TS optional `source` 字段可保留而不影响旧 UI，也可在未产生新数据前撤销；
- command names、storage directories 与现有 note fields不变，无反向 migration。
- workbench maximize 只包含 transient React state、context 与 layout class；删除对应 wiring 即可回退，不涉及数据迁移。
- notes Editor companion 是 additive union variant；移除 source action 的显式 option 与对应 layout branch 即可恢复原 chat companion，不涉及数据迁移。

## Open Questions

- 无阻塞问题。conversation backlink navigation、folder taxonomy 与 quick-save 可在后续独立 change 评估。
