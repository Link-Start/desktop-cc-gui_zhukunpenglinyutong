## 1. 修复 loading 状态机

- [x] 1.1 [P0, 无依赖] 在 `useFileDocumentState` 的读失败 `.catch` 分支中设置 `setLoadedFileReadTargetKey(fileReadTargetKey)`
- [x] 1.2 [P0, 无依赖] 在读过程中用户已产生脏改的早退分支中设置 `setLoadedFileReadTargetKey(fileReadTargetKey)`

## 2. 回归测试

- [x] 2.1 [P0, 依赖 1.1] 新增测试：读失败时 `isLoading` 变 false 且 error 可见
- [x] 2.2 [P0, 依赖 1.2] 新增测试：读过程中编辑，读返回后 loading 停止且保留本地草稿

## 3. 验证

- [x] 3.1 [P0, 依赖 2] `npm run typecheck` 通过
- [x] 3.2 [P0, 依赖 2] `npx vitest run src/features/files/hooks/useFileDocumentState.test.tsx` 全绿
- [x] 3.3 [P0, 依赖 2] 全量 `src/features/files` 测试通过（已知 pre-existing 失败 `fileSurfaceRuntimeBoundaryGuard.test.ts` 与本次改动无关）

## 4. OpenSpec 归档准备

- [x] 4.1 [P1, 依赖 3] Windows 实机验证经 product owner 明确授权 waived；当前 change 仅收口 loading 状态机，allowed-root 如有需要另开提案
- [x] 4.2 [P1, 依赖 4.1] 执行 verify / sync / archive
