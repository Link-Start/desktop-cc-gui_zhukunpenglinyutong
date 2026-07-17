## 1. Frontend Regression Fix

- [x] 1.1 [P0][depends:none][input:`useLayoutNodes.tsx` pending/history-loading projection][output: restoring-history 仅由 `historyLoadingByThreadId` 驱动][verify: focused Layout test] 删除 pending identity 到 history loading 的错误派生。
- [x] 1.2 [P0][depends:1.1][input: existing pending-thread Layout test][output: fresh `codex-pending-*` draft 断言 `isHistoryLoading=false`][verify: Vitest assertion passes] 更新回归测试。

## 2. Verification

- [x] 2.1 [P0][depends:1.1,1.2][input: touched frontend behavior][output: focused test evidence][verify: Layout、Messages history loading、thread sidebar cache suites pass] 运行 focused tests。
- [x] 2.2 [P1][depends:2.1][input: final diff and artifacts][output: type/spec validation evidence][verify: `npm run typecheck` and strict change validation pass] 完成 TypeScript 与 OpenSpec 验证。
  - Evidence: `npm run typecheck` and `openspec validate fix-codex-pending-draft-history-loading --strict --no-interactive` both exited `0` on 2026-07-17.
