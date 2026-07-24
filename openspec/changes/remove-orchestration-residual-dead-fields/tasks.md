# Tasks: remove-orchestration-residual-dead-fields

## 1. 删除前验证

- [x] 1.1 grep 全仓确认 `source: "orchestration"` / `taskSource: "orchestration"` / `orchestrationTaskId` 的生产方引用为零（仅测试与本任务列出的死分支命中）

## 2. 类型与实现删除

- [x] 2.1 `src/features/tasks/types.ts`：收窄 `TaskRunDefinitionRef.source` union，删除两处 `orchestrationTaskId?` 字段
- [x] 2.2 `src/features/tasks/utils/taskRunStorage.ts`：删除 `normalizeRun` 与 `createTaskRunRecord` 中的 orchestration 分支
- [x] 2.3 `src/features/tasks/utils/taskRunCoordinator.ts`：删除 `BeginTaskRunDefinition.orchestrationTaskId?` 与透传行

## 3. 测试清理

- [x] 3.1 `taskRunCoordinator.test.ts`：删除 orchestration run 用例并清理 import
- [x] 3.2 `taskRunStorage.test.ts`：删除 orchestration 用例，裁剪 legacy 用例为纯 Kanban 场景

## 4. 验证

- [x] 4.1 `npm run typecheck` 通过
- [x] 4.2 `npx vitest run src/features/tasks/utils/taskRunStorage.test.ts src/features/tasks/utils/taskRunCoordinator.test.ts` 通过（另跑 `src/features/tasks` 全域 10 个测试文件 46 个用例全部通过）
- [x] 4.3 对全部改动文件跑 `npx eslint` 无新增问题
