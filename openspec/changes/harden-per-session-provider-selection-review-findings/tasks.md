## 1. Canonical binding persistence

- [ ] 1.1 [P0, depends: none] 提取 path-only idempotent binding writer；输入 storage/workspace/session/engine/binding，输出 changed bool；用 Rust test 验证 canonical key restart readable
- [ ] 1.2 [P0, depends: 1.1] Claude/Kimi desktop 与 daemon forwarder 在 `SessionStarted` 写 canonical binding；用 targeted Rust tests/静态 parity check 验证

## 2. Kimi runtime hardening

- [ ] 2.1 [P0, depends: none] 修复 `interrupt_turn` 未命中污染与 kill failure owner 丢失；用双 runtime/owner retention Rust test 验证
- [ ] 2.2 [P0, depends: none] 为 provider TOML materialization 增加 file lock、0600 create、failure cleanup、unchanged no-op；用 permission/concurrency/idempotency Rust test 验证

## 3. Frontend fail-closed selection

- [ ] 3.1 [P1, depends: none] catalog load failure 显示 error toast，保留 remembered managed selection，不静默回退 local/default
- [ ] 3.2 [P1, depends: 3.1] 补 Sidebar/useSidebarMenus error 与 missing remembered provider Vitest

## 4. Review closure

- [ ] 4.1 [P0, depends: 1.2,2.1,2.2,3.2] 跑 targeted Rust/Vitest、TypeScript、runtime contracts、strict OpenSpec validation 与 `git diff --check`
- [ ] 4.2 [P0, depends: 4.1] 二次独立 review correctness/security/concurrency/render hard lines，记录 code-review evidence
- [ ] 4.3 [P1, depends: 4.2] sync delta specs、archive change、提交并执行 Trellis session record
