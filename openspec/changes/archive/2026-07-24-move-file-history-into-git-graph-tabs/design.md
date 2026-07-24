## Context

`useGitPanelController` 目前把 File History 建模为单个 `fileHistoryTarget` 并切换 `centerMode="fileHistory"`；`useLayoutNodes` 再把 `FileHistoryView` 挂到 editor layer。Git Graph 则由 AppShell 独立渲染 `GitHistoryPanel`。这导致 Git domain 内的两种历史视图分属不同导航系统，并且单 target state 无法同时保留多个文件历史。

约束：保持 `FileHistoryTarget`、Tauri Git commands、`FileHistoryView` 异步隔离与 diff renderer 不变；不覆盖当前工作区其他未提交变更；Git Graph title layer 必须继续满足 theme、overlay 与 compact density contracts。

## Goals / Non-Goals

**Goals:**

- Git Graph title layer 提供 pinned Git Graph tab 与多个 File History tabs。
- 所有现有 File History 入口统一打开 Git Graph，并按稳定 identity 去重/激活 tab。
- 关闭 active tab 时执行确定性的邻接 fallback，最后回到 Git Graph。
- 通过 focused tests 固化 state transitions、ARIA 与旧 diff behavior。

**Non-Goals:**

- 不持久化 File History tabs，不支持拖拽排序。
- 不把 Git domain tabs 合并进通用 file editor tabs。
- 不修改 backend、Git mutation 或 file-history fetch algorithm。

## Decisions

### 1. Multi-tab state 归属 `useGitPanelController`

Controller 持有 `fileHistoryTabs: FileHistoryTarget[]` 与 `activeGitHistoryTabId`，因为 File Tree/Git Diff 入口已经通过该 controller 汇合，AppShell 也从这里控制 Git Graph open state。`GitHistoryPanel` 只接收受控 tabs 与 callbacks，避免 panel remount 或 repository switch 时丢失 session tabs。

替代方案：由 `GitHistoryPanel` 本地持有 state。代码更局部，但外部入口无法原子完成“打开 panel + 去重 target + 激活 tab”，且 panel 关闭会丢失未显式关闭的 tabs。

### 2. Stable identity 使用 workspace/repository/path tuple

tab id 由 `workspaceId + repositoryRoot + path` 编码/拼接产生；`displayPath` 只用于 label，不参与 identity。这样 nested repository 和不同 workspace 的同名文件不会串页。

替代方案：只用 `displayPath`。实现更短，但 multi-repository/worktree 场景会发生 collision，不满足现有 path-domain contract。

### 3. Git Graph 是 pinned tab，document tabs 复用现有 toolbar 行

`FileHistoryView` 增加 embedded host mode，Git Graph wrapper 只构造 document tabs 与 active content 两个 opaque ReactNode slot；`GitHistoryPanelImpl` 在既有 `.git-history-toolbar` 中承载 tabs，并在其下切换 Graph body/File History body。禁止新增独立 titlebar/tab row。Standalone header contract 被移除，因为不再存在 standalone center surface。

替代方案：保留 File History 内部 header。可减少组件改动，但会出现 title strip + 第二层标题/关闭按钮，违背参考交互并重复 close authority。

### 4. Active tab fallback 采用右邻优先、左邻次之、Git Graph 兜底

关闭 inactive tab 不改变 active tab；关闭 active file tab 后先激活同 index 的右邻，否则左邻；没有 file tab 时激活 Git Graph。状态更新使用 functional setState，避免连续关闭时读取 stale tabs。

### 5. Tab chrome 采用 compact content-fit density

Pinned Git Graph tab 只显示 icon，通过 `aria-label/title` 保留可访问名称；File History tab 复用项目 `FileIcon`，可见 label 只显示 basename，完整 `displayPath` 保留在 `aria-label/title`，并提供 compact centered close action。文件 tab 使用 content-fit + bounded max-width，而不是固定等宽，减少多 tab 场景的无效占位。

### 6. File History tab context menu 复用 shared renderer menu

File History tab 右键菜单复用 `RendererContextMenu` 与现有 file editor tab 文案/icon。单个关闭沿用邻接 fallback；`关闭其他` 与 `全部关闭` 在 `useGitPanelController` 内各执行一次 functional state update，避免循环 close 造成中间 fallback/stale state。Pinned Git Graph tab 不暴露关闭菜单。

## Risks / Trade-offs

- [Risk] Git History panel 已是大型组件，直接塞入 tab state 会扩大 render scope → 受控 state 保持在 controller，panel 只根据 active target 切换主体；不复制 File History data logic。
- [Risk] 多个已打开 tab 同时 mount 会并发加载并增加内存 → 仅 mount active `FileHistoryView`；切换回来允许重新加载，符合 YAGNI 且成本可控。
- [Risk] 从旧 center mode 清理不完整会残留 composer/layout 特判 → 同步删除 `useLayoutNodes`、`DesktopLayout` 与 controller 的 `fileHistory` branches，并用 `rg` 哨兵检查。
- [Trade-off] tabs 本轮不持久化，关闭/reopen Git Graph 在当前 AppShell session 内保留，但 application restart 不恢复。

## Migration Plan

1. 添加 controller tab model 与 state transition tests，保留现有 public `handleOpenFileHistory` callback name。
2. 将 tab props 传入 `GitHistoryPanel`，把 tab strip 合入既有 Git Graph toolbar 并切换 active body。
3. 删除 editor-layer File History mount 和 `centerMode="fileHistory"` 特判。
4. 调整 File History embedded layout、i18n、ARIA 与 focused UI tests。
5. 运行 OpenSpec strict validation、focused Vitest、typecheck、lint。

回滚时恢复单 `fileHistoryTarget + centerMode` controller 路由及 editor layer mount，移除 Git History tab props/view；backend 与 persisted data 无需迁移。

## Open Questions

无。用户已确认支持多个 File History tabs；排序、持久化、拖拽不在本次范围。
