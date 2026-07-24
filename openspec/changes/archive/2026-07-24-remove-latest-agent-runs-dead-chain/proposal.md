# Proposal: remove-latest-agent-runs-dead-chain

## 背景与业务判断

`latestAgentRuns`（含配套的 `isLoadingLatestAgents` 与 `onSelectHomeThread`）原本是首页（Home / HomeChat）"Recent conversations" 卡片的数据链。该卡片已从 Home / HomeChat 本体移除，但整条数据链没有清理：AppShell 根层仍然每个 render 用 `useMemo` 计算 top-3 agent runs（`buildLatestAgentRuns`，O(threads) 遍历），再经 domain contexts → `useAppShellLayoutNodesSection` → `useLayoutNodes` → `HomeChat` 一路透传，最终 HomeChat 从未 destructure、Home 只用下划线丢弃。整条链是纯 dead code，且挂在 AppShell 根 hook 链上，违反仓库 render perf 红线精神（无消费方的根层计算）。

HomeChat 测试里保留的 "does not render recent conversations on the home page" 回归断言在死链删除后由类型层面结构性保证，该测试改为不依赖死 props 的等价断言。

## 范围

删除以下死链（删除前已逐一 grep 验证引用闭包）：

- `src/app-shell.tsx`：`buildLatestAgentRuns` / `resolveLatestAgentFeedLoading` import（:96-99）、`latestAgentRuns` 与 `isLoadingLatestAgents` 两个 `useMemo`（:1052-1073）、domain context 对象中的 `isLoadingLatestAgents,`（:1990）与 `latestAgentRuns,`（:2021）
- `src/app-shell-parts/latestAgentRuns.ts`（98 行，整文件删除）及其测试 `latestAgentRuns.test.ts`（约 104 行，整文件删除）
- `src/app-shell-parts/appShellDomainContexts.ts`：`"isLoadingLatestAgents"`（:392）、`"latestAgentRuns"`（:423）两个 owned key
- `src/app-shell-parts/useAppShellLayoutNodesSection.tsx`：destructure 中的 `isLoadingLatestAgents,`（:463）、`latestAgentRuns,`（:476），options 对象中的 `latestAgentRuns,` / `isLoadingLatestAgents,` / `onSelectHomeThread: handleSelectWorkspaceInstance,`（:1938-1940）
- `src/features/layout/hooks/useLayoutNodes.tsx`：`<HomeChat>` 上 `latestAgentRuns` / `isLoadingLatestAgents` / `onSelectThread={options.onSelectHomeThread}` 三个 props（:1609-1611）
- `src/features/layout/hooks/layoutNodesTypes.ts`：`LayoutNodesFlatOptions` 中 `latestAgentRuns` 类型字段、`isLoadingLatestAgents`、`onSelectHomeThread`（:308-318）及 Pick union 中对应三项（:877-879）
- `src/features/home/components/Home.tsx`：本地 `LatestAgentRun` type（:4-12）、三个 props 声明（:16-18）与下划线 destructure（:23-25）
- `src/features/home/components/HomeChat.tsx`：本地 `LatestAgentRun` type（:29-37）、三个从未 destructure 的 props 声明（:40-42）
- 测试同步清理：`Home.test.tsx`（:26-28）、`HomeChat.test.tsx`（baseProps :39-41 + "does not render recent conversations" 用例 :159-179 改写）、`HomeChat.interactions.test.tsx`（:44-46）、`useLayoutNodes.client-ui-visibility.test.tsx`（:627-629）

## 明确不动

- `handleSelectWorkspaceInstance` 本身（在 `useAppShellLayoutNodesSection.tsx:428` 有其他消费方），仅移除其作为 `onSelectHomeThread` 的下传
- `hasLoaded` / `threadListLoadingByWorkspace` / `lastAgentMessageByThread` / `threadStatusById` / `threadsByWorkspace` / `getWorkspaceGroupName` 等上游状态（有其他消费方）
- Sidebar / ThreadList / TopbarSessionTabs 等存活的 `onSelectThread` 链路（与 Home 死 props 同名但属不同链路）
- 全局索引文件（changes/README.md、archive/README.md、specs/README.md、config.yaml、project.md），不执行 archive

## 风险与验收

- 风险：极低。所有删除符号的引用闭包已 grep 验证，仅剩链内引用。
- 验收：`npm run typecheck` 通过；改动文件 `npx eslint` 通过；`app-shell` / `home` / `layout` 相关 vitest 通过。
