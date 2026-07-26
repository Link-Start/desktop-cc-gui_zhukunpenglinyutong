## 1. Registry Contract

- [x] 1.1 [P1][Depends: align-engine-runtime-capability-contract][Input: built-in engine maps/enums/adapters][Output: registry duplication inventory][Verify: frontend/Rust/daemon/realtime owners listed] 摸清 registry。
- [x] 1.2 [P1][Depends: 1.1][Input: inventory][Output: EngineId、source info、entry schema][Verify: builtin/external schema fixtures pass] 定义 identity/provenance。
- [x] 1.3 [P1][Depends: 1.2][Input: existing engine modules][Output: minimal EngineProtocol and EngineAdapter traits][Verify: protocol has no UI/session mutation] 定义分层接口。

## 2. Runtime Lifecycle

- [x] 2.1 [P1][Depends: 1.3][Input: process/session registries][Output: generation-based RuntimeManager][Verify: stale handle fails and resources release] 实现 lifecycle owner。
- [x] 2.2 [P1][Depends: 2.1][Input: one spawn-per-turn engine][Output: first adapter/protocol implementation][Verify: behavior parity tests] 验证 one-shot 模型。
- [x] 2.3 [P1][Depends: 2.1][Input: Codex app-server][Output: persistent adapter/protocol implementation][Verify: reuse/rebind/abort tests] 验证 persistent 模型。

## 3. Registry Migration

- [x] 3.1 [P1][Depends: 2.2,2.3][Input: built-in registry sets][Output: parity/schema CI gate][Verify: missing builtin and invalid external registration fail] 建治理 gate。
- [x] 3.2 [P1][Depends: 3.1][Input: remaining built-ins][Output: adapter registrations and compatibility facade][Verify: engine detection/send/history focused tests] 迁移剩余引擎。
- [x] 3.3 [P1][Depends: 3.2][Input: completed change][Output: verification report][Verify: Rust tests + typecheck + strict OpenSpec pass] 完成闭环验证。
