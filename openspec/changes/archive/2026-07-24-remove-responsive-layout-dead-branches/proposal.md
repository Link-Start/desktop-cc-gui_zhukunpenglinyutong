# Proposal: remove-responsive-layout-dead-branches

## Why（背景与业务判断）

`src/features/layout/hooks/useLayoutMode.ts:5` 硬编码 `return "desktop"`，注释自述 "to disable responsive layout"——Phone / Tablet 响应式布局是**产品上被有意禁用的方向**。由此 `useLayoutController.ts:36-39` 派生的 `isTablet` / `isPhone` 恒为 `false`，`AppLayout.tsx:127` / `:159` 的 `<PhoneLayout>` / `<TabletLayout>` 条件渲染分支永远走不到，但 `PhoneLayout.tsx`（119 行）与 `TabletLayout.tsx`（101 行）仍通过静态 import 打进 bundle。

本提案执行删除，即**确认放弃 Phone / Tablet 响应式布局方向**：删除后不存在任何可运行的 compact 布局入口，若未来要恢复该方向需要重新实现，而不是"打开开关"。这是有意的产品决策，不是临时降级。

## What Changes（改动范围）

引用闭包核实（删除前已逐一 grep）：

- `useLayoutMode` 全仓唯一消费方是 `useLayoutController.ts:1,36`；`LayoutMode` 类型无外部 import（`src/types/settings.ts:49` 的 `LayoutMode = "default" | "swapped"` 是同名的 settings 面板交换概念，与本 hook 无关，不动）。
- `useLayoutController` 唯一消费方是 `app-shell.tsx:247`，只解构 `isCompact` / `isTablet` / `isPhone`，**不解构 `layoutMode`**；`app-shell.startup.test.tsx:367` 的 mock 同样不含 `layoutMode`。
- `PhoneLayout` / `TabletLayout` 全仓仅被 `AppLayout.tsx:4-5` import，无测试、无 lazy chunk、无其他引用。
- `AppLayout` 唯一调用点是 `renderAppShell.tsx:515`；`isPhone` / `isTablet` 在 `renderAppShell.tsx` 内仅用于传给 `AppLayout`（`:201,:205,:516,:517`）。

具体改动：

1. 删除 `src/features/layout/hooks/useLayoutMode.ts`（6 行）。
2. `src/features/app/hooks/useLayoutController.ts`
   - 删除 `useLayoutMode` import（`:1`）与 `:36-39` 的派生逻辑；
   - 以 inline 常量 `const isCompact = false; const isTablet = false; const isPhone = false;` 替代，并保留注释说明响应式布局已被有意禁用；
   - 从 return 中删除无消费方的 `layoutMode` 字段。
   - **取舍说明**：`isCompact` / `isTablet` / `isPhone` 被下游 `useAppShellSections`、`useGitPanelController`、`useLayoutTopbarSessionTabs`、`useAppShellWorktreeChromeSection`、`useLayoutNodes` 等广泛解构，逐一清除会把爆炸半径扩到 app-shell 全链路与并行代理的文件域，故保留恒 false 常量作为最简实现；下游死判断的进一步清理记录为遗留问题。
3. `src/features/app/components/AppLayout.tsx`
   - 删除 `TabletLayout` / `PhoneLayout` 静态 import（`:4-5`）；
   - 删除 `isPhone` / `isTablet` prop（type + destructuring）；
   - 删除 `if (isPhone)` / `if (isTablet)` 两段死分支（`:127-187`，61 行）；
   - 随之不再解构仅死分支使用的 props（`tabletTab` / `showGitDetail` / `mainHeaderNode` / `tabletNavNode` / `tabBarNode` / `compactEmptyCodexNode` / `compactEmptySpecNode` / `compactEmptyGitNode` / `compactGitBackNode` / `debugPanelFullNode`），这些字段暂时保留在 `AppLayoutProps` type 中以保持调用点不变，作为遗留问题后续清理。
4. `src/app-shell-parts/renderAppShell.tsx`
   - 删除传给 `AppLayout` 的 `isPhone={isPhone}` / `isTablet={isTablet}`（`:516-517`）及对应 destructuring（`:201,:205`）；`renderAppShellTypes.ts` 的 `any` 类型字段与 `app-shell.tsx` 上游传递保持不变（最小锚点）。

预计删除约 300 行。不触碰 `DesktopLayout.tsx`、`useSidebarToggles`（`isCompact` 入参语义保留）及其他文件。

## 验收口径

- `npm run typecheck` 通过
- `npx eslint` 对全部改动文件通过
- `AppLayout` 相关 vitest（`app-shell.startup.test.tsx`、`DesktopLayout.test.tsx` 等改动域测试）通过
- grep 确认 `useLayoutMode` / `PhoneLayout` / `TabletLayout` 在 src 内无残留引用
- 运行时行为不变：布局恒走 `DesktopLayout` 分支，与改动前一致

## 遗留问题（只记录，不在本 change 修复）

- `useAppShellSections.ts:765-766,:1102-1103`、`useAppShellViewStateSection.ts:50`、`useGitPanelController.ts:300`、`useLayoutTopbarSessionTabs.tsx:423`、`useLayoutNodes.tsx:678-679`、`useAppShellWorktreeChromeSection.ts:94-109` 等处基于恒 false 的 `isTablet` / `isPhone` 的死判断与 `layout-phone` / `layout-tablet` class 拼接；
- `AppLayoutProps` 中不再被解构的 10 个 props 及 `renderAppShellTypes.ts` / `app-shell.tsx` 的对应传递链路。
