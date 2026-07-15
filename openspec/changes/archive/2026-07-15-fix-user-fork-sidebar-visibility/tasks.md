## 1. Fork Relationship Boundary

- [x] 1.1 [P0, depends: none] 移除 user Fork 对 generic Subagent relationship store 的写入；输入为 `startFork` action flow，输出为 Codex/Claude Fork 顶层 thread state；以 focused hook test 验证。
- [x] 1.2 [P0, depends: 1.1] 审计 Fork identity migration，确保 `claude-fork:* -> claude:<child>` 保留 title/items/active state 且不携带 Subagent relation；以 reducer/action test 验证。

## 2. Claude Provisional Visibility

- [x] 2.1 [P0, depends: 1.1] 在 workspace catalog reconciliation 中复用既有 Claude bootstrap identity helper 保留有效 provisional Fork；输入为 authoritative catalog + runtime rows，输出包含 `claude-fork:*` row；以 reducer/catalog test 验证 refresh 场景。

## 3. Regression Protection

- [x] 3.1 [P0, depends: 1.1, 2.1] 增加 Codex Fork、Claude provisional/canonical Fork 与真实 Subagent 的互斥回归断言；输出必须证明 Fork top-level、Subagent nested/labeled/default-collapsed。
- [x] 3.2 [P1, depends: 3.1] 运行 focused Vitest、`npm run typecheck`、OpenSpec strict validation，并记录验证结果；不得修改 backend command contract。

## 4. Fork Entrypoint Parity

- [x] 4.1 [P0, depends: 1.1] 移除幕布 message-tail Fork 对 `updateThreadParent` 的调用，并反转 source contract test；输入为 `handleForkFromMessage`，输出为与 composer Fork 一致的 top-level conversation projection。
- [x] 4.2 [P1, depends: 4.1] 运行 layout/Fork/Subagent focused tests、typecheck、lint 与 OpenSpec strict validation。

## 5. Claude Message Fork Lifecycle

- [x] 5.1 [P0, depends: 4.1] 为共享 message operation 增加显式 `operation: "fork" | "rewind"`，让幕布 Fork 保留 parent 并创建/命名/激活/load child，同时保持 Rewind destructive lifecycle 不变。
- [x] 5.2 [P0, depends: 5.1] 增加 Claude Fork/Rewind 与 first-message edge case 的互斥回归测试，并运行 focused Vitest、typecheck、lint、large-file sentry 与 OpenSpec strict validation。
