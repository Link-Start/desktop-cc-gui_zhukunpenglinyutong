# Verification: remove-project-map-orchestration-center

- Verified At: `2026-07-24`
- Scope: 删除 Project Map 内嵌 Orchestration Center，并保留 Kanban、TaskRun 与幕布关联运行跳转
- Branch: `feature/v-078`

## 1. Outcome

实现与自动化 contract 已闭环。`src/features/agent-orchestration/`、对应 i18n/CSS 资产和 main capability spec 已删除；共享 `ccgui:open-task-run` 事件迁移到 `tasks` 模块，事件名与 payload contract 保持不变。

人工 smoke 已确认冷启动正常、Kanban 创建并执行任务正常、Project Map surface 正常且无编排切换入口、幕布关联运行 banner 可跳转对应 Task Center run。

## 2. 分阶段 Gate

| Gate | Evidence | Result |
|---|---|---|
| G0 | `npm run typecheck`；Project Map / Tasks / Messages / Layout / app-shell-parts focused Vitest | passed |
| G1 | Messages、Task Center、`taskRunNavigationEvents` focused Vitest；`npm run typecheck` | passed；commit `929acbd75` |
| G2 | `npx vitest run src/app-shell-parts`；`npm run typecheck` | passed；commit `b83efeb9b` |
| G3 | Layout、Project Map、Tasks focused Vitest；`npm run typecheck` | passed；commit `fdf925f98` |
| G4 | `npm run typecheck`；`npm run lint`；`npm run test` | passed，默认 batched suite 889/889 test files；commit `49fdb2b4f` |
| G5 | `openspec validate --all --strict --no-interactive` | passed，433/433 items |

2026-07-24 收尾复验中，`npm run typecheck`、`npm run lint` 与 OpenSpec strict validation 再次通过。全量 Vitest duplicate rerun 覆盖到 312/889 test files 且零失败后停止；G4 的同一 source state 889/889 完整结果仍是权威全量门禁，此后仅修改 OpenSpec 文档。

收尾 focused regression：

- Messages / Task Center / navigation events：3 files，42 passed、2 skipped。
- Project Map / layout visibility：2 files，81/81 passed。

## 3. Structural Evidence

- `src/features/agent-orchestration/` 不存在。
- runtime source 中无 `agent-orchestration`、`OrchestrationCenterView`、`TASK_MODULE_ENTRYPOINTS_ENABLED`、`agentOrchestration` 悬挂引用。
- `src/features/messages/orchestration/` 保留；该目录仍承担消息组装职责。
- `src/features/kanban/**` 未被本 change 修改。
- main spec `openspec/specs/agent-task-orchestration-center/spec.md` 已删除；change delta 完整声明 14 个 `REMOVED Requirements`。
- 未新增 dependency、Tauri command、storage migration 或 Rust/IPC contract。

## 4. Manual Smoke

| Scenario | Evidence | Result |
|---|---|---|
| 应用冷启动 | 用户重启后未再出现 `Maximum update depth exceeded` | passed |
| Kanban 创建/执行任务 | 用户通过 Kanban 发出一个任务，执行表现正常 | passed |
| Project Map surface 正常且无编排切换入口 | 用户人工点击确认 | passed |
| 幕布关联运行 banner 跳转对应 Task Center run | 用户人工点击确认 | passed |

此前出现过一次冷启动 `Maximum update depth exceeded`，重启后未复现。本 change 未为该瞬态现象引入未经证实的修补；若再次出现，应保留 Console 第一条 warning/error 与 component stack，另建独立诊断 change。

## 5. Verify Verdict

完整性：33/33 tasks 已完成。

正确性：14 个 removed requirements 均有删除证据，TaskRun navigation 与 Kanban 保留路径有自动化及完整人工证据。

一致性：实现遵循 design 的“先迁共享事件、再断引用、最后删本体”顺序，未越过明确边界。

当前无 CRITICAL / WARNING。实现、自动门禁与人工 smoke 全部完成，准备 sync/archive。
