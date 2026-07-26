## 1. Delivery Contract

- [x] 1.1 [P1][Depends: align-engine-runtime-capability-contract,establish-unified-engine-event-bus][Input: current send/queue/interrupt paths][Output: prompt/steer/followUp/nextTurn behavior matrix][Verify: each built-in path classified] 完成 delivery inventory。
- [x] 1.2 [P1][Depends: 1.1][Input: behavior matrix][Output: typed intent/result/error schema][Verify: missing intent and silent success rejected] 定义 API。

## 2. State Machine

- [x] 2.1 [P1][Depends: 1.2][Input: capability lookup + runtime state][Output: delivery decision function][Verify: table tests cover supported/rejected/degraded] 实现纯决策层。
- [x] 2.2 [P1][Depends: 2.1][Input: run.settled events][Output: idempotent follow-up queue drain][Verify: duplicate settled delivers once] 接入 settlement。
- [x] 2.3 [P1][Depends: 2.1][Input: active runs][Output: steering adapter dispatch][Verify: Kimi rejects; capable engine routes correctly] 接入 steering。

## 3. UI And Diagnostics

- [x] 3.1 [P1][Depends: 2.2,2.3][Input: typed delivery results][Output: Composer/thread messaging compatibility facade and actionable feedback][Verify: rejected/degraded UI tests] 迁移发送入口。
- [x] 3.2 [P1][Depends: 3.1][Input: delivery decisions][Output: secret-safe diagnostics][Verify: intent/target/evidence/result present, credentials absent] 增加证据。
- [x] 3.3 [P1][Depends: 3.2][Input: completed change][Output: verification report][Verify: focused tests + typecheck + Rust tests + strict OpenSpec pass] 完成闭环验证。
