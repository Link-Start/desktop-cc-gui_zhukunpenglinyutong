## Context

当前 `WorkspaceNoteCardPanel` 由 `useLayoutNodes` 在 `filePanelMode === "notes"` 时作为 `gitDiffPanelNode` 渲染，最终进入 `DesktopLayout.right-panel-top`。组件同时承担 collection、list、selection、editor、preview 和 CRUD orchestration；数据能力完整，但窄栏布局迫使编辑器折叠并以双列 card 堆叠信息。

约束包括：继续复用 `noteCardsFacade` 与现有 Tauri/storage contract；入口仍属于 right-panel toolbar；conversation curtain 和 Composer 必须保持当前 thread；不得向 AppShell 根链增加高频 state；不得引入新 dependency。

## Goals / Non-Goals

**Goals:**

- `notes` 成为显式 `CenterMode`，由 layout 决定 note/chat 双列 composition。
- 默认左侧 chat : 右侧 note 宽度为 1 : 2，Composer 位于 chat column。
- note workbench 内形成紧凑稳定的 header、search/list 与 editor/preview hierarchy。
- 保留所有现有 CRUD、Markdown、image 和 focus-note behavior。

**Non-Goals:**

- 不改变 backend command、storage schema、attachment identity 或 context injection。
- 不增加 tags、pin、color、reminder、sync、autosave 等新 domain state。
- 不把 responsive desktop surface 扩展到 phone/tablet 的全新导航体系。

## Decisions

### 1. 新增独立 `notes` center mode

`CenterMode` 增加 `notes`。right toolbar 选择 notes 时同时保留 `filePanelMode = "notes"` 作为 active icon source，并把 center mode 切换为 notes；`useLayoutNodes` 输出独立 `noteCardsPanelNode`，不再把 panel 塞入 `gitDiffPanelNode`。

Alternative：复用 `editor` mode。放弃原因是 editor mode 绑定 file tab、split companion、maximize 和 close lifecycle，note surface 不应伪造 file identity。

### 2. Layout composition 拥有 1:2 比例与临时 resize

`DesktopLayout` 在 notes mode 下把左侧 chat layer 与右侧 note layer 设为 interactive，并把 Composer 放入 chat column。中间复用现有 pointer resize cleanup pattern；CSS variable 记录当前 note column 百分比，默认约 66.667%，拖动时同时约束 chat/note 的最小宽度。ratio 不进入持久化，避免为临时 workspace arrangement 新增 global state。

Alternative：在 note component 内嵌 conversation。放弃原因是会反转 ownership，重复传递 messages/composer 并污染 feature boundary。

### 3. 保留单组件 orchestration，重排内部信息架构

不拆分 facade/hook/data model。组件增加 local `query`，传给既有 `list` request；presentation 改为 toolbar + searchable list + active editor/archived preview。selected note 在 list 中保持可见，不再通过“从列表过滤 selected item”制造位置跳动。

Alternative：先抽完整 store/hook/component family。当前只有一个 consumer，抽象不会减少 duplication，且会扩大回归面。

### 4. 搜索使用现有 backend query contract

输入做短 debounce 后进入 `noteCardsFacade.list({ query })`，collection 改变时沿用同一 query text但请求对应 active/archive 集合。异步 effect 保留 cancellation guard，避免 stale response 覆盖新 collection/query。

## Risks / Trade-offs

- [新增 center mode 遗漏某个 exhaustive branch] → TypeScript union、layout tests 和 controller tests覆盖。
- [中央区宽度较小时 note/chat 文案溢出] → note column 与 chat column 都设 min-width，resize clamp 禁止拖过可用边界。
- [搜索请求与选择详情产生 race] → list effect cancellation、workspace scope guard、selected identity continuity。
- [组件已有行为在重排中回退] → 复用现有 handlers，focused tests覆盖 create/edit/archive/restore/delete/search。
- [right panel notes 内容为空] → notes mode 下 `gitDiffPanelNode` 回落到 file tree，而 active toolbar 状态仍由 `filePanelMode` 保持。

## Migration Plan

1. 扩展 `CenterMode` 与 notes entry handler，保持旧 filePanelMode 作为 toolbar selection fact。
2. 增加独立 layout node 与 Desktop notes split。
3. 重排 `WorkspaceNoteCardPanel` markup/CSS并接入 query。
4. 更新 i18n 与 tests，执行 focused tests、typecheck、lint、visual verification。

Rollback：撤销 `notes` mode、node wiring 与 note presentation diff 即可恢复原右侧 surface；backend/storage 不需要迁移。

## Open Questions

无。固定 1:2 比例与不新增数据模型已由本次需求确定。
