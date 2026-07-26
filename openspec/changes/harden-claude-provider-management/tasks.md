## 1. Storage Migration

- [ ] 1.1 [P1][Depends: none][Input: canonical + legacy keys/callers][Output: storage ownership inventory][Verify: every read/write/listener site classified] 摸清 triple-write。
- [ ] 1.2 [P1][Depends: 1.1][Input: key inventory][Output: canonical-only storage helper and idempotent migration][Verify: canonical-wins/legacy-only/repeat/malformed fixtures] 实现迁移。
- [ ] 1.3 [P1][Depends: 1.2][Input: current writers/listeners][Output: removed legacy writes and deduped storage events][Verify: only canonical key is written] 切换 owner。

## 2. Error Contract

- [ ] 2.1 [P1][Depends: none][Input: load/save/switch/delete backend paths][Output: typed action result/error union][Verify: cause/context round-trip tests] 定义错误类型。
- [ ] 2.2 [P1][Depends: 2.1][Input: provider hook/actions][Output: explicit propagation and durable-state rollback][Verify: failure matrix covers four actions] 迁移 hook。
- [ ] 2.3 [P1][Depends: 2.2][Input: typed errors][Output: inline/toast diagnostics][Verify: UI never reports success on failure] 接入 UI。

## 3. Verification

- [ ] 3.1 [P1][Depends: 1.3,2.3][Input: existing reorder/activation flows][Output: compatibility regression tests][Verify: ordering and active provider behavior unchanged] 防回退。
- [ ] 3.2 [P1][Depends: 3.1][Input: completed change][Output: verification report][Verify: focused Vitest + typecheck + strict OpenSpec pass] 完成闭环验证。
