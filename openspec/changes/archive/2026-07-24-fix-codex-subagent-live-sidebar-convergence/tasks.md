## 1. Behavior Contract

- [x] 1.1 记录 live `thread/started` relationship-safe first projection requirement。

## 2. RED Regression

- [x] 2.1 添加 full Codex child notification 的 hook/reducer RED test。
- [x] 2.2 添加 parent-side `subAgentActivity` live/history compatibility RED test。

## 3. Implementation

- [x] 3.1 在 `onThreadStarted` normalize live parent/nickname metadata。
- [x] 3.2 扩展 `ensureThread` atomic metadata merge，并保持 no-op guard。
- [x] 3.3 在 shared linking boundary 处理 `subAgentActivity`，立即绑定 parent/child 并写入 provisional name。

## 4. Verification

- [x] 4.1 运行 focused tests、typecheck、lint、runtime contracts 与 strict OpenSpec validation。
- [x] 4.2 follow-up 仅运行受影响 Vitest 与 file-scoped ESLint，遵守用户不运行全局测试的要求。

## 5. Review

- [x] 5.1 审查 diff、记录 verification evidence 与 remaining risks。
