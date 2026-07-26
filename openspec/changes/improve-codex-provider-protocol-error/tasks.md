## 1. Backend protocol preflight

- [x] 1.1 [P0] 输入 managed provider `configToml`，实现完整 `model_providers` map 的 `wire_api` validator；输出稳定 unsupported marker，依赖：无；验证：Rust unit tests 覆盖 selected/unselected chat、responses 与 missing。
- [x] 1.2 [P0] 在 provider runtime materialization 前调用 validator，确保 `chat` 不会落盘或 spawn；依赖：1.1；验证：focused materialization test。

## 2. Frontend actionable error

- [x] 2.1 [P0] 输入 backend stable marker，在 shared create-session error resolver 中映射为 i18n actionable copy；输出不包含 raw pipe/OS error；依赖：1.1；验证：`useWorkspaceActions` focused tests。
- [x] 2.2 [P1] 为现有 locales 增加 Codex protocol incompatibility copy，明确 Responses 与 protocol router 两条路径；依赖：2.1；验证：TypeScript typecheck 与 locale import。

## 3. Verification

- [x] 3.1 [P0] 运行 backend/frontend focused tests、`npm run typecheck`、`npm run check:runtime-contracts`；依赖：1.2、2.2；输出：全部通过或记录既有非目标失败。
- [x] 3.2 [P0] 执行 `openspec validate improve-codex-provider-protocol-error --strict --no-interactive` 并复核 diff 不包含 CC Switch 工作；依赖：3.1；输出：strict validation 通过、scope clean。

## 4. Global custom error presentation

- [x] 4.1 [P0] 将 Codex protocol incompatibility 从 native `window.alert` 切换到现有 global sticky Error Toast；依赖：2.1；验证：focused hook test 断言 toast payload 与 alert 未调用。
- [x] 4.2 [P0] 执行增量 review、focused Vitest、target ESLint、typecheck、Rust focused tests 与 OpenSpec strict validation；依赖：4.1；输出：scope 内检查通过后独立提交。

## 5. Invalid TOML error contract

- [x] 5.1 [P0] shared Codex provider parser 对非法 TOML 返回稳定 `[codex_provider_config_invalid]` marker，且 materialization 前失败；依赖：无；验证：Rust focused tests 覆盖 smart quote 与 secret-safe marker。
- [x] 5.2 [P0] create-session frontend 将 invalid config marker 映射为本地化 global sticky Error Toast，不展示 raw parser stack；依赖：5.1；验证：focused hook test。

## 6. Native Alert elimination

- [x] 6.1 [P0] 将 `src/**` 现存生产 `alert()` / `window.alert()` 迁移到 existing `pushErrorToast`；依赖：无；验证：target tests 与 production source scan。
- [x] 6.2 [P0] 在 ESLint 增加 production native Alert 禁令，同时允许 test-only assertions/fixtures；依赖：6.1；验证：target ESLint 与 intentional negative lint probe。
- [x] 6.3 [P1] 使用 `update-spec` 更新 frontend quality code-spec，写明 scope、contract、matrix、tests 与 Wrong/Correct；依赖：6.2；验证：人工 spec review。

## 7. Incremental verification and delivery

- [x] 7.1 [P0] 运行 focused Vitest、target ESLint、typecheck、Rust focused tests、runtime contracts 与 OpenSpec strict validation，不运行 full suite；依赖：5.2、6.3。
- [ ] 7.2 [P0] review scope、独立提交并执行 Trellis session record；依赖：7.1。
