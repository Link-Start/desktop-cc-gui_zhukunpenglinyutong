## Why

File tree 是桌面 AI 编程客户端的核心工作区入口。用户从这里打开、预览、复制、粘贴、重命名文件，也会通过右侧面板切换 diff、file view、project surfaces。

既成事实是：file tree panel 已重做，root actions 和 icon helpers 已加入，right-panel tabs 支持 pinning，layout nodes 与 PanelTabs 已同步。缺少 OpenSpec 会导致后续把 file tree 当普通 CSS polish，而忽略它是文件操作入口。

本 proposal 记录边界：file tree UI 可以重构，但 root actions、row interaction、panel pinning 不得被破坏；backend file IO command contract 不在本次改动范围内。

## What Changes

- 重做 `FileTreePanel`、`FileTreeRows`、`FileTreeRootActions`。
- 新增 `fileTreeIcons` utility。
- right-panel tabs 支持 pinning。
- 更新 layout nodes 和 panel tabs integration。

## Scope / Impact

- Affected commits: `3c8e868e`.
- Impact file/surface: `src/features/files/components/FileTreePanel.tsx`
- Impact file/surface: `src/features/files/components/FileTreeRows.tsx`
- Impact file/surface: `src/features/files/components/FileTreeRootActions.tsx`
- Impact file/surface: `src/features/files/utils/fileTreeIcons.ts`
- Impact file/surface: `src/features/layout/components/PanelTabs.tsx`
- Impact file/surface: `src/features/layout/hooks/useLayoutNodes.tsx`
- Impact file/surface: `src/styles/file-tree.css`
- Impact file/surface: `src/styles/panel-tabs.css`

## Non-Goals

- 不改变 backend file IO command contract。
- 不改变 workspace path resolution。
- 不引入新的 file storage model。

## Retroactive Note

这是 retroactive OpenSpec change。代码已经按上述 commits 落地，并且用户确认当前最新代码已测试、功能体验满意。本 change 的目标是把既成事实沉淀为可验证的 behavior contract，便于后续 sync / archive / regression review。
