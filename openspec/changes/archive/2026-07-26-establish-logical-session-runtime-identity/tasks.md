## 1. Identity Model

- [x] 1.1 [P0][Depends: align-engine-runtime-capability-contract][Input: current thread/session/event IDs][Output: logical/native/pending/run/turn/item type inventory][Verify: Kimi/Claude/Codex paths mapped] 完成 identity inventory。
- [x] 1.2 [P0][Depends: 1.1][Input: inventory][Output: typed identity values and serialization schema][Verify: legacy records decode without rewrite] 建立 identity contract。

## 2. Mapping Boundary

- [x] 2.1 [P0][Depends: 1.2][Input: pending/native evidence][Output: alias mapping registry with tombstone][Verify: late event resolves canonical] 实现 alias owner。
- [x] 2.2 [P0][Depends: 1.2][Input: legacy prefixed IDs][Output: single compatibility parser][Verify: parser fixtures cover all built-ins] 收敛 prefix boundary。
- [x] 2.3 [P0][Depends: 2.1,2.2][Input: domain objects/events/actions][Output: explicit engine/session identity propagation][Verify: no new business-layer prefix dependency] 迁移关键调用链。

## 3. Convergence And Governance

- [x] 3.1 [P0][Depends: 2.3][Input: Kimi/Claude promotion sequences][Output: identity convergence tests][Verify: history-first/late-delta/terminal-after-promotion pass] 锁定乱序行为。
- [x] 3.2 [P1][Depends: 2.2][Input: branch scanner][Output: registry-backed engine set and fallback telemetry][Verify: injected literal branch fails] 加强治理 gate。
- [x] 3.3 [P0][Depends: 3.1,3.2][Input: completed change][Output: verification evidence][Verify: focused tests + typecheck + Rust tests + strict OpenSpec pass] 完成闭环验证。
