## Why

Header、Sidebar、Panel tabs 是全局导航骨架，不是普通视觉细节。它们决定用户如何进入 session、打开 app surface、切换 panel、看到版本/插件入口。

既成事实是：subagent trees 默认折叠并重排；open-app actions 可 pin 到 toolbar；MainHeader 移除了 branch switcher/worktree rename；Plan panel 默认折叠并在线程切换时保持；PanelTabs 不再因 live state 强制外显；Sidebar 底部新增版本标签和置灰插件入口。

这组变更共同目标是降噪：减少 transient live state 和低频管理入口对主导航的打扰，同时保留用户显式 pin/activate 的控制。

## What Changes

- ThreadList subagent 默认折叠与排序调整。
- Header toolbar 支持 pin open-app actions。
- MainHeader 移除 branch/worktree 管理 UI。
- Plan panel 默认 collapsed，线程切换时保持。
- PanelTabs visible state 与 transient live state 解耦。
- Sidebar 新增 version tag 和 disabled plugin coming-soon entry。

## Scope / Impact

- Affected commits: `8f16b5d9`, `5c225ff5`, `e2ce2d6f`, `521e7178`, `8f1d4fe2`, `e0f2c1a6`, `f59a7543`.
- Impact file/surface: `src/features/app/components/ThreadList.tsx`
- Impact file/surface: `src/features/app/components/MainHeader.tsx`
- Impact file/surface: `src/features/app/components/OpenAppMenu.tsx`
- Impact file/surface: `src/features/app/components/Sidebar.tsx`
- Impact file/surface: `src/features/app/components/SidebarVersionTag.tsx`
- Impact file/surface: `src/features/layout/components/PanelTabs.tsx`
- Impact file/surface: `src/app-shell-parts/useAppShellViewStateSection.ts`
- Impact file/surface: `src/styles/main.css`
- Impact file/surface: `src/styles/sidebar*.css`

## Non-Goals

- 不改变 Git branch/worktree backend 能力。
- 不改变 session catalog data model。
- 不实现插件市场，只提供 coming-soon feedback。

## Retroactive Note

这是 retroactive OpenSpec change。代码已经按上述 commits 落地，并且用户确认当前最新代码已测试、功能体验满意。本 change 的目标是把既成事实沉淀为可验证的 behavior contract，便于后续 sync / archive / regression review。
