# Tasks: grok-cli-reasoning-effort

## 1. Capability declaration

- [x] 1.1 fixture：`grok.reasoning.effort = supported`
- [x] 1.2 main spec：`openspec/specs/engine-capability-matrix/spec.md` 增补 Grok requirement
- [x] 1.3 `EngineFeatures::grok().reasoning_effort = true`（lib + daemon bridge）
- [x] 1.4 `node scripts/check-engine-capability-matrix.mjs --write`

## 2. Runtime transport

- [x] 2.1 `grok.rs` allowlist + `--reasoning-effort`
- [x] 2.2 unit：合法档写入 / 非法档丢弃

## 3. Frontend control surface

- [x] 3.1 `GROK_REASONING_OPTIONS` + `getEffectiveReasoning*`
- [x] 3.2 `ButtonArea` 为 grok 渲染 `ReasoningSelect`
- [x] 3.3 session / send normalize 放行 grok allowlist
- [x] 3.4 无 thread 时 draft selection 注入（与 Claude 对齐）

## 4. Verification

- [x] 4.1 matrix check
- [x] 4.2 vitest：modelSelection / selectedComposerSession / messageRuntime / ButtonArea
- [x] 4.3 cargo test `reasoning_effort`
- [x] 4.4 人工：外观选择器（用户确认）；内部 argv 契约由单测锁定

## 5. Docs / closeout

- [x] 5.1 本 change proposal / design / tasks / delta specs
- [x] 5.2 `docs/reports/grok-cli-reasoning-effort-2026-08-01.md` + reports 索引
- [x] 5.3 校准 `add-grok-engine` 非目标说明（reasoning effort 已拆本 change）
