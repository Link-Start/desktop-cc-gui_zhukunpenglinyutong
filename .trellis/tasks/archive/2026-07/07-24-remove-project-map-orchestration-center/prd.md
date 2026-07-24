# Remove Project Map Orchestration Center

## Goal

完成 OpenSpec change `remove-project-map-orchestration-center`，从 S4 断点继续，确保代码、测试、OpenSpec、Trellis 与 Git 状态全部闭环。

## Requirements

- 保留已经完成并提交的 S0-S3 实现。
- 完成 `src/features/agent-orchestration/`、相关 i18n 与 `orchestration-center__*` CSS 资产删除。
- 严禁误删 `src/features/messages/orchestration/` 或修改 kanban 非编排逻辑。
- 执行 G4/G5 全量质量门禁并记录证据。
- 完成 OpenSpec verify、sync/archive 与 Trellis session record。

## Acceptance Criteria

- [ ] `src/features/agent-orchestration/` 不存在。
- [ ] runtime source 中无编排中心残余引用，历史 archive/docs 除外。
- [ ] `npm run typecheck`、`npm run lint`、`npm run test` 全绿。
- [ ] `openspec validate --all --strict --no-interactive` 通过。
- [ ] `verification.md` 完整记录基线、gate 与 smoke 证据。
- [ ] OpenSpec change 完成 verify、sync/archive。
- [ ] Trellis task 完成并记录 session。

## Technical Notes

- OpenSpec change 是 behavior single source of truth。
- 采用既有 S0-S5 分阶段计划，不扩展范围、不引入依赖。
- CSS 仅删除选择器包含 `orchestration-center__` 的完整规则；混合 selector rule 需保留非编排 selector 的等价声明。
- 每个 implementation commit 后立即执行 Trellis session record。
