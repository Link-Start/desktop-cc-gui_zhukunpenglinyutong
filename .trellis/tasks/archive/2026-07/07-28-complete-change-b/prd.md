# 补全 Change B Execution Target 闭环

## Goal

完成 OpenSpec change `compose-shared-session-execution-target` 的剩余任务，使 Shared Session
具备可验证的四级 Execution Target、durable V2 send、恢复与 owner routing 闭环，并达到
进入 Change C 的 Gate 4。

## Requirements

- Picker 只更新 `selectedNextTarget`，Turn Badge 只读取 immutable snapshot。
- `SharedSessionMeta` 显式升级为 schema v2，并保持旧数据只读迁移兼容。
- Provider/Model 在 runtime side effect 前真实校验；不可用时 fail closed，不重路由。
- Prompt acceptance 与 terminal settlement 使用 typed boundary，分别提交
  `turnAccepted` / `turnCommitted`，duplicate settlement 幂等。
- Provisioning 完整持久化 `prepared → creating → ready/recovery-required`。
- Probe 使用 native runtime identity evidence；崩溃窗口禁止重复创建。
- Interrupt/Approval/Pending Rebind/Recovery 按完整 Execution Target 路由。
- lossy projection 必须显式确认；Cancel 由 adapter capability 决定。
- 更新 OpenSpec tasks、verification evidence 与 master checklist。

## Acceptance Criteria

- [x] OpenSpec Change B tasks 40/40。
- [x] Gate 4 矩阵由真实 UI/service/runtime boundary 的增量测试覆盖。
- [x] Shared 相关增量 Vitest、TypeScript typecheck、scoped ESLint 通过。
- [x] Rust Shared V2 定向测试、`cargo check --lib`、runtime contract check 通过。
- [x] OpenSpec strict validation 与 verify 通过。
- [x] Review 无未解决的 correctness / data-loss / routing finding。
- [x] 代码提交并完成 Trellis session record。

## Technical Notes

- 复用现有 Composer provider/model catalog、canonical sink、runtime dispatch 与 owner routing。
- 不引入新依赖，不重写 V0 runtime。
- 不跑全量测试；只跑 Change B 影响范围的增量测试。
- 无法由 deterministic test 替代的桌面人工项不得虚假勾选；优先构建可执行的 contract test。
