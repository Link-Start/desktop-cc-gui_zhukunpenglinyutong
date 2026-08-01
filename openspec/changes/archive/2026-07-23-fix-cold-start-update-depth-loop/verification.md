## Verification Summary

- Change: `fix-cold-start-update-depth-loop`
- Result: PASS
- Scope: incremental frontend validation only；按用户要求未运行 full test suite。

## Evidence

### Regression attribution

- Pre-fix focused regression：等价 `workspaces` rerender 后，`getClientStoreSync` 从 mount 后 2 次增加到 3 次，证明 workspace-derived effect 仍会重新调度 source refresh。
- Post-fix：同一 regression 保持 mount 后 read count 不变；projection reference 稳定。
- Counter-cases：listener attach 前 storage mutation、workspace rename、真实 recent-file event 均可见。

### Automated checks

- `npx vitest run src/features/quick-switcher/hooks/useQuickSwitcherRecentFiles.test.tsx src/features/quick-switcher/recentFiles.test.ts src/app-shell.startup.test.tsx --reporter=verbose`
  - 3 files passed
  - 19 tests passed
- `npx eslint src/features/quick-switcher/recentFiles.ts src/features/quick-switcher/hooks/useQuickSwitcherRecentFiles.ts src/features/quick-switcher/hooks/useQuickSwitcherRecentFiles.test.tsx`
  - passed
- `npm run typecheck`
  - passed
- `npm run build`
  - passed
  - only pre-existing CSS property、dynamic/static import 与 chunk-size warnings remained
- `openspec validate fix-cold-start-update-depth-loop --strict --no-interactive`
  - passed

## Requirement Mapping

- Equivalent workspace catalog：`workspaceCatalogsEqual` + stable workspace ref prevents source-state refresh。
- Pre-listener mutation：mount effect subscribes first, then refreshes normalized storage snapshot。
- Workspace rename：semantic workspace comparison invalidates the pure memoized projection without client-store migration。

## Residual Risk

- 无法在当前会话内替换并首次启动正在承载本会话的 `/Applications/ccgui.app`；desktop package smoke 留给新包安装后的首次冷启动验证。自动回归已覆盖本次可执行 feedback edge。
