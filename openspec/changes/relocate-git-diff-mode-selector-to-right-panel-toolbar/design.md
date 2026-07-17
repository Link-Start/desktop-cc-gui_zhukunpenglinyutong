## Context

Desktop right panel 由 `DesktopLayout` 顺序渲染 `rightPanelToolbarNode` 与 `gitDiffPanelNode`。`PanelTabs` 属于 toolbar layer；`GitDiffPanel` 的 mode selector 则位于 content layer 的绝对定位 `.git-panel-header--hover-actions`，并由 `.diff-panel--floating-git-actions` 预留顶部空间。

selector 自身已经集中持有完整交互：`isModeMenuOpen`、trigger/menu refs、adaptive alignment、outside click、Escape focus restore、mode/layout/Hub callbacks。项目已有 `headerControlsTarget` + `createPortal` 模式，因此无需提升或复制这些业务状态。

## Goals / Non-Goals

**Goals:**

- desktop Git tab 激活时，selector 位于 `right-panel-toolbar` 左侧，`PanelTabs` 保持右侧响应式布局。
- selector 的 DOM 可以跨 layout layer 挂载，但 React owner、state、refs 与 callbacks 继续属于 `GitDiffPanel`。
- target 未建立时保留 inline fallback，避免 lazy mount 首帧丢失交互。
- selector 外置后回收无用内容区空间；worktree apply action 仍使用原 action row。
- normal、swapped 与 narrow panel 下保持 menu 可见。

**Non-Goals:**

- 不重构 `PanelTabs` / `ResponsiveIconToolbar`。
- 不改变 Git mode 或 file list state ownership。
- 不外置 worktree apply action。
- 不覆盖 phone/tablet/compact layout。

## Decisions

### 1. 在 layout helper 中提供显式 toolbar mount target

`buildRightPanelToolbarNode` 接收 optional callback ref，并仅当 active tab 为 `git` 时渲染 `.right-panel-git-mode-slot`。slot 位于 `PanelTabs` 之前：normal layout 显示在左侧；现有 row-reverse swapped layout 自动镜像到右侧。

Alternative：由 `GitDiffPanel` 通过 `document.querySelector()` 查找 toolbar。该方案依赖 global DOM selector、难以测试且无法保证多窗口/多实例安全，因此不采用。

### 2. 由 `useLayoutNodes` 连接 target 与 `GitDiffPanel`

`useLayoutNodes` 使用 callback ref state 接收 mount target，并通过 optional `headerControlsTarget` prop 传给当前 Git panel。这个 state 只在 tab mount/unmount 时变化，不进入高频 render path。

Alternative：引入 Context。只有同一 layout hook 内两个 sibling node 需要连接，Context 会增加无必要 abstraction，因此不采用。

### 3. Portal 同一个 selector node，保留 inline fallback

`GitDiffPanel` 把现有 selector JSX 提取为 local node：

```text
target exists
  -> createPortal(modeSelectorNode, target)
target missing
  -> render modeSelectorNode in existing inline action row
```

React event、state、refs、outside click 与 Escape handler 均继续由原 component 管理。worktree apply button 不进入 Portal；只有 selector 发生 placement 变化。

### 4. 用 explicit class 控制内容区 reservation

当 `headerControlsTarget` 存在且没有 worktree apply action 时，panel 添加 external-selector class，将 top padding 恢复为 base content padding。若 worktree action 存在，仍保留原浮动 action row 和 reservation。

不使用 `:has()` 推断 Portal 状态，避免 DOM 跨层后 selector 不再是 panel descendant 导致 selector contract 隐晦。

### 5. toolbar slot 允许 overlay，但响应式 tabs 继续自裁剪

`.right-panel-toolbar` 允许 slot menu 向下展开；`.panel-tabs` 自身仍保留 `overflow: hidden` 与 `ResponsiveIconToolbar` width measurement。slot 为 `flex: 0 0 auto`，tabs 使用现有 `flex: 1 1 auto; min-width: 0` 消化剩余空间。

menu 的 adaptive alignment 继续基于 `panelRef` 与 `modeTriggerRef` 计算，在左侧 slot 下将自然选择 left alignment。

### 6. Review hardening 使用 explicit toolbar class 与 pre-open measurement

toolbar 已经持有 `active === "git"` 的 React fact，因此直接输出 `.has-git-mode-slot` class，并用该 class 放开 menu overlay。禁止依赖 `.right-panel-toolbar:has(...)` 才解除 `overflow: hidden`：Tauri 使用 system WebView，旧 WebKit 对 `:has()` 的支持不能覆盖项目声明的全部 macOS baseline，unsupported selector 会让整条 overflow override 失效。

selector 从原 content 右侧移动到 normal toolbar 左侧后，旧的 initial `right` alignment 不再是可靠首帧值。trigger 从 closed 切换到 open 前先复用 `updateModeMenuLayout()`，让 geometry state 与 open state 在同一 interaction batch 内提交；existing effect、`ResizeObserver` 与 window resize listener 继续负责 menu 打开后的尺寸变化。不能仅把 initial alignment 改成 `left`，否则 swapped layout 会产生镜像问题。

## Risks / Trade-offs

- [Risk] callback ref 首次挂载会触发一次 `useLayoutNodes` rerender → 使用 inline fallback 保证首帧可达；target 建立后只迁移同一 React owner 下的 node。
- [Risk] toolbar `overflow` 放开后影响 tabs → tabs 自身保持 overflow boundary，且 slot/menu 有 feature-scoped class 与 z-index。
- [Risk] system WebView 不支持 `:has()` 时 menu 被 toolbar clipping → 使用 React 已知 active state 输出 explicit class，不把关键可达性绑定到 relational selector support。
- [Risk] normal/swapped layout 首次展开沿用 stale alignment → open 前同步复用现有 geometry measurement，后续变化仍由 existing observers 收敛。
- [Risk] selector 占用窄面板宽度导致 tab 挤压 → slot 固定为 selector intrinsic width，`PanelTabs` 的 existing collapse/overflow 机制处理剩余空间。
- [Risk] worktree apply action 被意外迁移或隐藏 → selector 与 apply node 分开渲染，并增加 external-target focused test。
- [Trade-off] layout hook 增加一个 nullable HTMLElement state → 换取无 global DOM query、可测试且 instance-safe 的连接契约。

## Migration Plan

1. 增加 toolbar target 与 optional prop contract。
2. Portal selector，并保留 inline fallback。
3. 调整 toolbar/menu overflow 与 panel top reservation。
4. 增加 focused tests，运行 frontend gates。

Rollback：移除 target/prop/Portal 分支并恢复 selector inline render；无数据、API 或 persisted state migration。

## Open Questions

无。目标位置、desktop scope 与“原行为全部保留”已由用户确认。
