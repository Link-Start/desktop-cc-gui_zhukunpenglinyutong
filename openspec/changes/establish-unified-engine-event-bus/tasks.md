## 1. Event Contract

- [x] 1.1 [P0][Depends: establish-logical-session-runtime-identity][Input: current Rust/TS events][Output: MossxAgentEvent envelope and event mapping inventory][Verify: every active engine event classified] 定义 bus schema。
- [x] 1.2 [P0][Depends: 1.1][Input: lifecycle terminal evidence][Output: run settlement state machine][Verify: completion/failure/cancel/replaced/duplicate fixtures settle once] 定义 `run.settled`。

## 2. Bus Runtime

- [x] 2.1 [P0][Depends: 1.2][Input: envelope][Output: private Rust publisher and bounded subscriber queues][Verify: slow sink does not block publisher] 实现 bus core。
- [x] 2.2 [P0][Depends: 2.1][Input: critical/delta events][Output: critical lane and delta coalescing/backpressure diagnostics][Verify: critical events never drop in stress fixture] 实现背压策略。
- [x] 2.3 [P0][Depends: 2.1][Input: Codex/Claude/Kimi runtime output][Output: shadow adapter mappings][Verify: old/new event parity snapshots] 接入活跃 engines。

## 3. Compatibility Bridge

- [x] 3.1 [P0][Depends: 2.2,2.3][Input: common bus events][Output: frontend compatibility sink][Verify: existing realtime/app-server tests unchanged] 接通 frontend。
- [x] 3.2 [P0][Depends: 3.1][Input: streaming pressure workload][Output: render/batching evidence][Verify: liveAssistantTextChannel retained; no per-delta root dispatch] 验证渲染红线。
- [x] 3.3 [P0][Depends: 3.2][Input: parity evidence][Output: old direct forwarder removal/feature-flag cutover][Verify: no duplicate delivery and rollback switch documented] 完成 owner 切换。
- [x] 3.4 [P0][Depends: 3.3][Input: completed change][Output: verification report][Verify: Rust tests + focused Vitest + typecheck + strict OpenSpec pass] 完成闭环验证。
