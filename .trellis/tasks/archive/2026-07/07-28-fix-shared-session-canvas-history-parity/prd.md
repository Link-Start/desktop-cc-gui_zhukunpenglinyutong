# 修复 Shared Session 幕布历史一致性

## OpenSpec Change

`fix-shared-session-canvas-history-parity`

## Goal

复用 Native Session 的 normalized adapter/assembler 事实链，使 Shared Session realtime 与 history 对 reasoning 和 Execution Target Badge 保持一致。

## Requirements

- realtime Shared assistant item 固化 `activeTurnTarget`。
- Shared history 保留 Legacy transcript reasoning/tool，并用 canonical projection 覆盖 frozen identity。
- explicit local/default target 固化 disk Provider semantic。
- 不访问 Native history files，不新增 root subscription/轮询，不迁移用户数据。

## Acceptance Criteria

- [ ] realtime assistant row 显示 CLI / Provider / Model / Reasoning Badge。
- [ ] reload 后 Badge 一致。
- [ ] reload 后 reasoning 不丢失、不重复、顺序稳定。
- [ ] focused Vitest、typecheck、changed-file lint、strict OpenSpec validation 通过。

## Technical Notes

实现与验收以 `openspec/changes/fix-shared-session-canvas-history-parity/**` 为行为 single source of truth。用户明确要求不跑全量测试，仅执行增量验证。
