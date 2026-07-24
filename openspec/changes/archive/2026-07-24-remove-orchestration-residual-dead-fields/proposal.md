# Proposal: remove-orchestration-residual-dead-fields

## 背景与判断

编排中心（orchestration center）已于 2026-07-24 整体删除（见已归档 `remove-project-map-orchestration-center`）。当时 TaskRun 域有意保留了少量 `orchestration` 残留字段“留待后续评估”。现经 grep 全仓验证，这些字段已无任何生产方（producer）：全仓 `source: "orchestration"` / `taskSource: "orchestration"` 仅命中测试文件。继续保留会让 `TaskRunDefinitionRef.source` union、`orchestrationTaskId` 字段及 storage/coordinator 中的 orchestration 分支成为误导性死代码，增加类型与 normalize 逻辑的阅读成本。

## Scope

删除以下残留死字段与死分支（约 70 行）：

- `src/features/tasks/types.ts`
  - `TaskRunDefinitionRef.source` union 中的 `"orchestration"`（:72）
  - `TaskRunDefinitionRef.orchestrationTaskId?`（:75）
  - `CreateTaskRunInput.orchestrationTaskId?`（:126）
- `src/features/tasks/utils/taskRunStorage.ts`
  - `normalizeRun` 中 orchestration source/orchestrationTaskId 分支（:262-263, :279, :282）
  - `createTaskRunRecord` 中 orchestrationTaskId 计算（:388-391）
- `src/features/tasks/utils/taskRunCoordinator.ts`
  - `BeginTaskRunDefinition.orchestrationTaskId?`（:35）
  - `beginTaskRunFromDefinition` 中 orchestrationTaskId 透传（:127）
- 覆盖死代码的测试：
  - `src/features/tasks/utils/taskRunCoordinator.test.ts` orchestration run 用例（:165-192，含 import 清理）
  - `src/features/tasks/utils/taskRunStorage.test.ts` orchestration 用例（:76-95）与 legacy 用例中的 orchestration 部分（:140-181 裁剪为纯 legacy Kanban 用例）

## 兼容性判断

- 持久化兼容：历史 `taskCenter.taskRuns` store 中若存在 `source: "orchestration"` 的旧 run，`normalizeRun` 现在统一归一为 `"kanban"`（原逻辑中 orchestration 专属字段仅用于展示链接，已无消费方），不会导致 parse 失败或数据丢失。
- 行为兼容：`BeginTaskRunDefinition.source` / `CreateTaskRunInput.taskSource` 保留（仅 union 收窄为 `"kanban"`），现有 Kanban 调用方签名不变。
- 明确不做：不删 `beginTaskRunFromDefinition` 导出（`beginTaskRunWithTrigger` 内部依赖）；不动 `TaskCenterView.test.tsx` 中仅引用文案 key 的用例；不清理其他域（browser-agent、styles、i18n）中同名但语义无关的 "orchestration" 字样。

## Out of Scope

- 其他文件中语义无关的 "orchestration" 命名（startup-orchestration、messages/orchestration、spec-hub orchestration 等）。
- `taskCenter.action.openOrchestrationTask` i18n key 的存留评估（无生产方引用，但不在本任务文件域）。

## 验证

- 删除前 grep 确认零生产方（已完成，见 verification 记录）。
- `npm run typecheck` 通过。
- 改动域 vitest：`src/features/tasks/utils/taskRunStorage.test.ts`、`src/features/tasks/utils/taskRunCoordinator.test.ts` 通过。
- 对改动文件跑 `npx eslint` 无新增问题。
