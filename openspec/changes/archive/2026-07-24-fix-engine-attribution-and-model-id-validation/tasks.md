# Tasks: fix-engine-attribution-and-model-id-validation

## 1. Engine attribution: 二元假设修复(commit 1)

- [x] 1.1 [P0, depends: none] 将 `EngineTaskOutputEngine` 从 `"claude" | "codex"` 放宽为 `EngineType`(`src/features/engine-task-output/types.ts`)。
- [x] 1.2 [P0, depends: 1.1] `buildTaskOutputSourceFromNotification` 用显式 engine normalize 替代 `=== "codex"` 三元,unknown 值 fallback `"claude"`(`engineTaskOutputProjection.ts`)。
- [x] 1.3 [P0, depends: 1.1] `useStatusPanelData` options 新增 `activeEngine?: EngineType | null`,taskOutput attribution 优先使用真实引擎值,保留旧 boolean 兜底(`useStatusPanelData.ts`)。
- [x] 1.4 [P0, depends: 1.3] `StatusPanel.tsx` 将 `statusPanelEngine` 计算前移并传入 `useStatusPanelData`;`useLayoutNodes.tsx` 直传 `options.selectedEngine`。
- [x] 1.5 [P0, depends: 1.2, 1.3] 更新 `useStatusPanelData.test.ts` 与 `engineTaskOutputProjection.test.ts`:覆盖 `kimi` 透传与 unknown fallback。

## 2. isValidModelId 校验收敛(commit 2)

- [x] 2.1 [P0, depends: none] `vendors/types.ts` 的 `MODEL_ID_PATTERN` / `isValidModelId` 改为 re-export `composer/types/provider.ts` 的单一实现。
- [x] 2.2 [P0, depends: 2.1] `provider.test.ts` 增加两侧收敛断言(同一函数引用、非法字符拒绝、长度上限一致)。

## 3. Verification

- [x] 3.1 [P0, depends: 1.5, 2.2] 运行 focused 测试:status-panel / engine-task-output / composer provider / vendors 相关 suite 全部通过。
- [x] 3.2 [P0, depends: 3.1] `npm run typecheck` 与 `npm run lint`(changed files)通过。
- [x] 3.3 [P0, depends: 3.2] `openspec validate --strict` 通过;无 main spec 需 sync 时直接 archive。
