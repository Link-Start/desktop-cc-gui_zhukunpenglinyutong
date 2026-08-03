## 1. Canonical Delivery Envelope

- [x] 1.1 [P0][deps: none][input: `prepare_delivery` / `accept_delivery` 与 `BindingStateUpdate`][output: 两类 delivery fact 统一通过 canonical writer 原子写入完整 tagged envelope][verify: focused Rust delivery tests 检查 payload `type`、`fact_type` 与 Binding state]
- [x] 1.2 [P0][deps: 1.1][input: duplicate delivery append][output: canonical writer 幂等边界保持单一 logical fact][verify: focused Rust duplicate append assertion]

## 2. Legacy Projection Compatibility

- [x] 2.1 [P0][deps: none][input: `StoredEvent.fact_type` + type-less object payload][output: projector decode boundary 补齐缺失 tag；embedded conflict fail closed][verify: `shared_projection` Rust tests 覆盖兼容与冲突]
- [x] 2.2 [P0][deps: 2.1][input: type-less delivery facts 后跟 requested/committed facts][output: rebuild 恢复完整 user/assistant items 并写 checkpoint][verify: focused projection rebuild test]

## 3. Shared History Recovery Ownership

- [x] 3.1 [P0][deps: 2.1][input: Shared projection error + Legacy items][output: 有 Legacy 时可观测降级，无 Legacy 时传播 projection error][verify: `sharedHistoryLoader` Vitest]
- [x] 3.2 [P0][deps: 3.1][input: successful empty Shared projection / Shared loader error][output: 空 session 正常 loaded；错误保持 retryable 且不掉入 Native fallback][verify: thread actions focused Vitest]
- [x] 3.3 [P0][deps: 3.2][input: Shared history recovery failure presentation][output: Shared 不生成 Native recovery card；Native 行为不变][verify: Messages Shared/Native 对照 Vitest]
- [x] 3.4 [P1][deps: 3.1][input: title metadata 更新][output: history lookup 始终使用稳定 `shared:<UUID>`][verify: Shared loader/session identity regression assertions]

## 4. Verification And Spec Closure

- [x] 4.1 [P0][deps: 1.2,2.2,3.4][input: backend touched modules][output: Rust focused suites 全部通过][verify: `cargo test --manifest-path src-tauri/Cargo.toml --test shared_projection` 与相关 delivery suite]
- [x] 4.2 [P0][deps: 3.4][input: frontend touched modules][output: focused Vitest 与 TypeScript contract 通过][verify: targeted `vitest run` + `npm run typecheck`]
- [x] 4.3 [P0][deps: 4.1,4.2][input: OpenSpec artifacts][output: strict validation 通过并同步 task 状态][verify: `openspec validate fix-shared-canonical-history-recovery --strict --no-interactive`]
