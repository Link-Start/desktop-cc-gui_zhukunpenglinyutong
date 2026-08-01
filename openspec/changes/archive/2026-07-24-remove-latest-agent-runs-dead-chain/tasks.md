# Tasks: remove-latest-agent-runs-dead-chain

- [x] 1. grep 验证死链全部符号的引用闭包（latestAgentRuns / buildLatestAgentRuns / resolveLatestAgentFeedLoading / isLoadingLatestAgents / onSelectHomeThread / LatestAgentRun）
- [x] 2. 删除 `src/app-shell-parts/latestAgentRuns.ts` 与 `src/app-shell-parts/latestAgentRuns.test.ts`
- [x] 3. 清理 `src/app-shell.tsx`：import、两个 useMemo（:1052-1073）、domain context 下传（:1990、:2021）
- [x] 4. 清理 `src/app-shell-parts/appShellDomainContexts.ts` 两个 owned key（:392、:423）
- [x] 5. 清理 `src/app-shell-parts/useAppShellLayoutNodesSection.tsx` destructure（:463、:476）与 options（:1938-1940）
- [x] 6. 清理 `src/features/layout/hooks/useLayoutNodes.tsx` `<HomeChat>` 三个 props（:1609-1611）
- [x] 7. 清理 `src/features/layout/hooks/layoutNodesTypes.ts` 字段（:308-318）与 Pick union（:877-879）
- [x] 8. 清理 `src/features/home/components/Home.tsx` 与 `HomeChat.tsx` 死 props 与本地 LatestAgentRun type
- [x] 9. 同步清理四个测试文件中的死 props（Home.test / HomeChat.test / HomeChat.interactions.test / useLayoutNodes.client-ui-visibility.test）
- [x] 10. 验证：`npm run typecheck`、改动文件 `npx eslint`、相关 vitest 全绿
- [x] 11. commit + Trellis session record
