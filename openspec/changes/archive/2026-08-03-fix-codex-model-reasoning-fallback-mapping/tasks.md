## 1. Model-specific fallback metadata

- [x] 1.1 [P0][依赖: 无] 输入当前 verified Codex model catalog，输出 generated rows 中 Sol/Terra/Luna/GPT-5.5 的精确 `supportedReasoningEfforts/defaultReasoningEffort`；验证 JSON shape 与模型映射一致。
- [x] 1.2 [P0][依赖: 1.1] 输入 generated fallback rows，输出 `CODEX_MODEL_CATALOG` 原样复用逐模型 metadata 并删除统一四档注入；验证 runtime-first merge 结构不变。
- [x] 1.3 [P0][依赖: 1.1] 保留 shared generated catalog 的既有 `lastVerifiedAt`；本次仅验证 Codex metadata，不误标其他 engines 的 freshness。

## 2. Regression protection

- [x] 2.1 [P0][依赖: 1.2] 输入 degraded empty `model/list`，输出四个 built-in models 各自的 options/default；验证 focused `useModels` tests。
- [x] 2.2 [P0][依赖: 1.2] 输入非空 runtime model metadata，输出 runtime options/default 原样覆盖 fallback；验证现有 deferred/runtime tests 继续通过。
- [x] 2.3 [P0][依赖: 1.2] 输入无 reasoning metadata 的 custom/unknown model，保持“默认”展示与 `selectedEffort = null`；不新增伪造档位。
- [x] 2.4 [P0][依赖: 2.1, 2.3] 覆盖 Native 单一会话 Composer：built-in model 消费逐模型 options，`gpt-5.3-codex-spark` 保持 capability-neutral，并把 resolver effort 保持为 `null`。
- [x] 2.5 [P0][依赖: 2.4] 覆盖 Native 单一会话 send：custom runtime model 通过 `sendUserMessage` 发送 `effort = null`，且不调用 Shared route。
- [x] 2.6 [P0][依赖: 2.5] 使用 fake app-server 覆盖 Native custom model wire：top-level `effort = null`、`reasoning.effort = low`、dispatch receipt effort 仍为 `null`。

## 3. Verification

- [x] 3.1 [P0][依赖: 2.1, 2.2, 2.4, 2.5, 2.6] 运行 affected focused Vitest、`npm run typecheck`、target ESLint、`git diff --check`；不运行全量 tests。
  - 已通过：focused Vitest 4 files / 148 tests、`npm run typecheck`、target ESLint、Rust Native custom-model wire test、Rust generated fallback focused test、model catalog contract check、Rust format check、`git diff HEAD --check`。
  - 补充审计：未改动的既有 provider A/B/A Rust 对照测试仍在 2s request capture 处 timeout；本 change 已恢复其 helper 与调用为原样，不扩大修复范围。
  - 收口决定：用户于 2026-08-01 明确要求提交收口且不运行全量 tests。
- [x] 3.2 [P0][依赖: 3.1] 运行 `openspec validate fix-codex-model-reasoning-fallback-mapping --strict --no-interactive`，确认 artifacts 与实现一致。
