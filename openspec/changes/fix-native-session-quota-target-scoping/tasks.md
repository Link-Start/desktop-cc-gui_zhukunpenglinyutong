# Tasks

## 1. OpenSpec

- [x] 1.1 创建 proposal / design / spec delta / tasks
- [ ] 1.2 实现完成后按需 sync 主 spec `status-panel-session-overview`（archive 时）

## 2. Target 收集契约

- [x] 2.1 `sessionQuotaTargets.ts`：`collectSessionQuotaTargets` 增加 `includeHistory`（默认 `true` 保持 Shared 行为）；`false` 时跳过 items 扫描
- [x] 2.2 单测：Native/current-only 忽略 history 多 profile；Shared/history 仍去重收集

## 3. StatusPanel 门闩

- [x] 3.1 `StatusPanel` 新增 prop `isSharedSession`（默认 `false`）
- [x] 3.2 构建 `sessionQuotaTargets` 时：`includeHistory: isSharedSession`
- [x] 3.3 `useLayoutNodes` 传 `isSharedSession={isSharedSession}`（同源 `threadKind === "shared"`）

## 4. Verify

- [x] 4.1 相关 Vitest：`sessionQuotaTargets` / sessionOverview 19 tests 全绿
- [ ] 4.2 typecheck 相关路径干净（本地可选；改动为 prop 透传 + 纯函数）
