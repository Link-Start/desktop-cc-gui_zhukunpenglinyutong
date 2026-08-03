## 1. Provider Catalog Atomic Scope

- [x] 1.1 [P0, 无依赖] 输入 active thread 与 engine/provider state，补充 cross-engine selection regression test；输出应证明 mismatch scope 不调用 catalog RPC、last-good catalog 不清空。
- [x] 1.2 [P0, 依赖 1.1] 输入同一 active thread snapshot，实现 atomic engine/provider catalog scope 与 semantic equality guard；通过 1.1 focused test 验证。

## 2. Diagnostics Incremental Persistence

- [x] 2.1 [P0, 无依赖] 输入现有 diagnostics persistence API，补充初始化、增量 flush、clear/reload 与 feedback-loop regression tests；输出应锁定 retention/export semantics。
- [x] 2.2 [P0, 依赖 2.1] 输入 buffered diagnostics 与 persisted snapshot，实现 module-local canonical cache、incremental merge/trim/persist；通过 rendererDiagnostics focused suite 验证。

## 3. Streaming Render Isolation

- [x] 3.1 [P0, 无依赖] 输入 normalized `agentMessage` snapshot events，补充 pure text growth、structural change 与 terminal convergence regression tests；输出应证明 Timeline stable input 不被纯正文增长替换。
- [x] 3.2 [P0, 依赖 3.1] 输入 active assistant snapshot 与 live-text channel，实现窄 fast-path，保留 durable structure/terminal dispatch；通过 streaming 与 Timeline focused suites 验证。

## 4. Quality Gates

- [x] 4.1 [P0, 依赖 1.2/2.2/3.2] 运行 touched frontend focused Vitest suites，输出全部通过结果。
- [x] 4.2 [P0, 依赖 4.1] 运行 `npm run typecheck`、`npm run lint` 与 runtime contract gate，输出零新增错误。
- [x] 4.3 [P0, 依赖 4.2] 运行 OpenSpec strict validation，并记录仍需人工 runtime 复测的 catalog、diagnostics 与 streaming evidence。
