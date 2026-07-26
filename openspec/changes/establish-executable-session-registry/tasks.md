## 1. Registry And Persistence Schema

- [ ] 1.1 [P1][Depends: establish-logical-session-runtime-identity,define-engine-adapter-protocol-registry][Input: current session/process/catalog owners][Output: executable registry ownership inventory][Verify: every live handle/control path assigned] 摸清 session control。
- [ ] 1.2 [P1][Depends: 1.1][Input: identity/lifecycle contracts][Output: registry entry、generation、transition、cursor schema][Verify: old state can initialize empty-compatible registry] 定义 schema。

## 2. Runtime Control

- [ ] 2.1 [P1][Depends: 1.2][Input: runtime manager][Output: register/rebind/resolve/release APIs][Verify: stale generation fails] 实现内存 registry。
- [ ] 2.2 [P1][Depends: 2.1][Input: control commands/events][Output: separate serial control lane][Verify: settled-follow-up fixture has no self-wait deadlock] 隔离 control plane。
- [ ] 2.3 [P1][Depends: 2.1][Input: transitions][Output: append-only record and durable cursor][Verify: crash/replay convergence tests] 实现持久恢复。
- [ ] 2.4 [P1][Depends: 2.3][Input: long transition log][Output: checkpoint/compaction preserving idempotency evidence][Verify: pre/post compaction replay equal] 控制日志增长。

## 3. Projection And Verification

- [ ] 3.1 [P1][Depends: 2.2,2.3][Input: registry snapshots][Output: selector-based frontend catalog projection][Verify: delta does not change shell snapshot reference] 接入前端。
- [ ] 3.2 [P1][Depends: 3.1][Input: existing session actions][Output: migrated controls and removed duplicate owners][Verify: create/resume/abort/delete focused tests] 迁移控制调用方。
- [ ] 3.3 [P1][Depends: 3.2][Input: completed change][Output: verification report][Verify: replay/deadlock/render tests + typecheck + Rust + strict OpenSpec pass] 完成闭环验证。
