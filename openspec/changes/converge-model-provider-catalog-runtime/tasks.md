## 1. Catalog Contract

- [ ] 1.1 [P1][Depends: align-engine-runtime-capability-contract][Input: Codex/Claude/Kimi/OpenCode catalog sources][Output: source/precedence/duplicate-owner inventory][Verify: every source classified runtime/configured/cache/fallback] 摸清目录事实源。
- [ ] 1.2 [P1][Depends: 1.1][Input: inventory][Output: shared ModelInfo/provider/protocol/provenance DTO][Verify: Rust/daemon/TypeScript round-trip tests] 定义 DTO。
- [ ] 1.3 [P1][Depends: 1.2][Input: precedence contract][Output: deterministic merge function][Verify: table fixtures cover collisions/order] 实现 merge policy。

## 2. Cache And Sources

- [ ] 2.1 [P1][Depends: 1.3][Input: refresh results][Output: transactional last-good cache with stale/error][Verify: failed refresh preserves prior selection] 实现 cache。
- [ ] 2.2 [P1][Depends: 2.1][Input: Codex runtime/fallback owners][Output: one generated fallback + runtime source][Verify: frontend/backend roster parity] 收敛 Codex。
- [ ] 2.3 [P1][Depends: 2.1][Input: Claude builtin/settings/custom][Output: shared DTO projection preserving override behavior][Verify: custom model fixtures unchanged] 收敛 Claude。
- [ ] 2.4 [P1][Depends: 2.1][Input: Kimi config/env/builtin][Output: shared source loaders and provider metadata][Verify: provider survives DTO] 收敛 Kimi。

## 3. Consumer Migration

- [ ] 3.1 [P1][Depends: 2.2,2.3,2.4][Input: frontend catalog consumers][Output: removed duplicate fallback/prefix inference][Verify: degraded-mode model lists deterministic] 迁移 UI/controller。
- [ ] 3.2 [P1][Depends: 3.1][Input: generated fallback][Output: freshness/lifecycle parity gate][Verify: injected roster drift fails] 加治理 gate。
- [ ] 3.3 [P1][Depends: 3.2][Input: completed change][Output: verification report][Verify: catalog tests + typecheck + Rust + strict OpenSpec pass] 完成闭环验证。
