# Tasks: inline-refresh-codex-model-config-passthrough

- [x] 1. grep 验证 `refreshCodexModelConfig` 引用闭包（唯一调用方 `useModelConfigRefresh.ts:50`，另有其测试与 startup test mock）
- [x] 2. `src/app-shell-parts/useModelConfigRefresh.ts`：移除 import 并在 codex 分支内联 `await refreshModels()`
- [x] 3. 删除 `src/features/models/refreshCodexModelConfig.ts` 与 `refreshCodexModelConfig.test.ts`
- [x] 4. 清理 `src/app-shell.startup.test.tsx:301-305` 对应 `vi.mock`
- [x] 5. 验证：`npm run typecheck`、改动文件 `npx eslint`、相关 vitest 全绿
- [x] 6. commit + Trellis session record
