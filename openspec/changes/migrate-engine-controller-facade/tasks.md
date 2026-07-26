## 1. Characterization And Ownership

- [x] 1.1 [P2][Depends: align-engine-runtime-capability-contract,define-engine-adapter-protocol-registry,converge-model-provider-catalog-runtime][Input: useEngineController callers/state/effects][Output: field/action/owner inventory][Verify: every return value and side effect mapped] 建立 characterization。
- [x] 1.2 [P2][Depends: 1.1][Input: current startup/switch/refresh/storage flows][Output: facade equivalence tests][Verify: sequence snapshots pass before migration] 锁定行为。

## 2. Ownership Migration

- [x] 2.1 [P2][Depends: 1.2][Input: canonical availability registry][Output: controller availability delegation][Verify: detection/status tests and no dual write] 迁移 availability。
- [x] 2.2 [P2][Depends: 2.1][Input: canonical selection owner][Output: controller selection delegation][Verify: persistence/switch/storage event tests] 迁移 selection。
- [x] 2.3 [P2][Depends: 2.2][Input: shared catalog runtime][Output: controller model projection delegation][Verify: refresh/custom/fallback parity] 迁移 catalogs。
- [x] 2.4 [P2][Depends: 2.3][Input: runtime diagnostics owner][Output: controller notice delegation][Verify: notice dedupe and lifecycle tests] 迁移 notices。

## 3. Facade And Render Cleanup

- [x] 3.1 [P2][Depends: 2.4][Input: migrated facade][Output: removed duplicate maps/merge/migration/effects][Verify: owner duplication scan clean] 删除旧债务。
- [x] 3.2 [P2][Depends: 3.1][Input: streaming workload][Output: stable low-frequency facade snapshot][Verify: no per-delta facade/AppShell recompute] 验证渲染隔离。
- [x] 3.3 [P2][Depends: 3.2][Input: final callers][Output: narrowed or removed facade under governance threshold][Verify: large-file gate + typecheck] 完成结构收口。
- [x] 3.4 [P2][Depends: 3.3][Input: completed change][Output: verification report][Verify: focused tests + render gate + typecheck + strict OpenSpec pass] 完成闭环验证。
