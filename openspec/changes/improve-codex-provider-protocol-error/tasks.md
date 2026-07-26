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
