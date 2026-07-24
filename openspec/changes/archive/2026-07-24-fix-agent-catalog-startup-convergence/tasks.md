## 1. Regression Coverage

- [x] 1.1 [P0, no dependency] 扩展 `useSelectedAgentSession` tests：输入 persisted built-in selection、deferred catalog readiness 与 pending-to-canonical migration；输出 bounded render/storage writes，使用 focused Vitest 验证。
- [x] 1.2 [P0, depends on 1.1] 扩展 AppShell startup test：输入 cold-start settings lifecycle；输出单一 catalog reload ownership 与无 React #185，使用 focused Vitest 验证。

## 2. Startup Convergence Fix

- [x] 2.1 [P0, depends on 1.1] 在 `useSelectedAgentSession` 引入同步 cache ref 与统一 equality-gated cache writer；输出 reload/migration 不再订阅自身写入的 React cache state，使用 hook tests 验证。
- [x] 2.2 [P0, depends on 1.2] 删除 AppShell duplicate mount catalog reload，保留 Settings close refresh；输出每个 lifecycle transition 单一 reload owner，使用 startup tests 验证。

## 3. Verification And Contract Sync

- [x] 3.1 [P0, depends on 2.1 and 2.2] 运行 selected-agent/AppShell focused Vitest、`npm run typecheck` 与 `npm run lint`；输出全部通过或修复发现的问题。
- [x] 3.2 [P1, depends on 3.1] 运行 `openspec validate --all --strict --no-interactive` 并核对实现与 `agent-startup-selection-stability` scenarios；输出 strict validation 通过。
