## Context

`FileViewPanel` 当前维护一个仅含 `{ visible, x, y }` 的私有 tab menu，并把 `onContextMenu` 同时挂在 tab strip 与各 tab control 上。该状态无法知道用户右键的是哪个 tab，菜单也重复实现 outside click 与位置裁剪。项目已有 portal-based `RendererContextMenu`、detached file explorer、`resolveFileGitScope`、file history controller 和 `useFileGitBlame`，因此本变更应组合现有能力而非新增平行实现。

## Goals / Non-Goals

**Goals:**

- 让 file tab context menu 显式绑定目标 path。
- 提供关闭当前、关闭其他、关闭全部、detached open 与只读 Git submenu。
- 复用 shared context menu，并为所有 action 提供 icon slot。
- main window 与 detached explorer 各自在自己的 tab state owner 内原子执行 close-other。
- 保持 theme、viewport、outside click、Escape 与 keyboard focus 行为一致。

**Non-Goals:**

- 不改变 backend command、Git write action、dirty confirmation 或 file document lifecycle。
- 不把 file-specific Git logic移入 shared UI。
- 不移除 tab bar 现有 close/detach buttons。

## Decisions

### Decision: menu state stores the target path

`FileViewPanel` 将 menu state 收敛为 `RendererContextMenuState | null`，由 `openTabContextMenu(event, tabPath)` 构造 items。关闭、detached open、file history 与 blame action 都闭包捕获同一个 normalized tab path。

Alternative：继续读取 `activeTabPath`。拒绝，因为右键后台 tab 时会误操作 active tab。

### Decision: reuse `RendererContextMenu` with optional icons

给 leaf item 与 submenu 增加 optional `icon: ReactNode`，render 时放入固定尺寸、`aria-hidden` 的 icon slot。无 icon 的既有 callers DOM/行为保持不变。

Alternative：在 `FileViewPanel` 复制一套 Chrome-like menu。拒绝，因为会重复 portal、submenu、viewport 和 dismiss contract。

### Decision: close-other is atomic at the state owner

主窗口在 `useGitPanelController` 增加 `handleCloseOtherFileTabs(path)`；detached window 在 `useDetachedFileExplorerState` 增加等价 action。transition 校验目标存在后一次写入 `{ openTabs: [path], activeFilePath: path }`，并清理不属于目标的 navigation/highlight state。

Alternative：在 component 中循环调用 `onCloseTab`。拒绝，因为 React batching、fallback selection 和 stale closure 会让结果依赖调用顺序。

### Decision: Git submenu remains read-only

- `显示文件历史` 使用 `resolveFileGitScope(tabPath, gitRepositories)` 构建 `FileHistoryTarget`，只有 main layout 提供 `onOpenFileHistory` 且 scope 有效时启用。
- `Git Blame` 对 active tab 直接 toggle；后台 tab 先激活并记录 pending blame intent，待 `filePath` 收敛到目标后 toggle。
- detached explorer 没有 file-history center mode，因此按既有 file-history contract 省略该项；Blame 仍可用。

Alternative：加入 Stage/Unstage/Discard。拒绝，因为它会引入 write command、状态刷新、确认与多 repository error contract，超出已确认边界。

### Decision: viewport positioning uses the shared clamp helper

menu 使用 pointer viewport 坐标与 `clampRendererContextMenuPosition`，不再依赖 panel-relative absolute position。shared portal 负责 viewport overlay；菜单高度通过 `estimateRendererContextMenuHeight(items)` 推导。

## Data Flow

1. `contextmenu(tabPath)` 阻止 native menu。
2. Resolve Git scope and capability flags for `tabPath`。
3. Build `RendererContextMenuItem[]` with icons、separator、disabled state and closures。
4. Shared menu renders in portal and owns dismiss/submenu behavior。
5. Selected action delegates to the existing state owner or detached/Git capability。
6. State owner performs one transition and the view rerenders from canonical tab state。

## Risks / Trade-offs

- [Risk] shared menu icon type扩展影响既有 callers → optional field；保留无 icon render path，并补 shared component test。
- [Risk] blame action在 tab activation 后过早执行 → pending path ref + effect，仅在 `filePath === pendingPath` 时 toggle，并在 target消失时清理。
- [Risk] close-other 清理错误的 workspace → transition 继续通过 existing `fileTabWorkspaceKey` scope。
- [Risk] file history 对 nested repository path 解析错误 → 复用 `resolveFileGitScope`，不手写 path slicing。
- [Trade-off] detached explorer 中省略 file history，而非构建新的 history surface；保持此次改动最小且不伪造不可用能力。

## Migration Plan

1. 扩展 shared menu icon type/style，保持 backward compatibility。
2. 增加 main/detached close-other state action 与 tests。
3. 替换 `FileViewPanel` 私有 menu state/render，接入 detached/Git actions。
4. 更新 i18n、visual contract 与 focused interaction tests。
5. 运行 lint、typecheck、focused/full tests、large-file 与 strict OpenSpec validation。

Rollback：回退 optional icon extension、tab callbacks、menu construction 与对应 styles/tests；backend 和 persisted data 无迁移。

## Open Questions

- 无。Git scope 已由用户确认限定为文件级安全操作。
