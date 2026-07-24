# Proposal: inline-refresh-codex-model-config-passthrough

## 背景与业务判断

`src/features/models/refreshCodexModelConfig.ts` 是一个 9 行的纯透传 helper：函数体只有 `await refreshModels()`，没有附加任何 codex 特有逻辑。它的唯一调用方是 `src/app-shell-parts/useModelConfigRefresh.ts:50` 的 codex 分支。这个 indirection 只增加了一个文件、一个 import、一个 mock 面（`app-shell.startup.test.tsx:301-305`），没有承载任何语义。

本 change 把调用内联进 codex 分支（直接 `await refreshModels()`），删除 helper 与其测试，并清理 startup test 里对应的 `vi.mock`。`app-shell.tsx:571` 的 `useModelConfigRefresh` hook 挂接保持不变。

## 范围

- 删除 `src/features/models/refreshCodexModelConfig.ts`（9 行）与 `src/features/models/refreshCodexModelConfig.test.ts`（约 25 行）
- `src/app-shell-parts/useModelConfigRefresh.ts`：移除 import（:3），codex 分支内联 `await refreshModels()`（:49-50）
- `src/app-shell.startup.test.tsx`：移除 `vi.mock("./features/models/refreshCodexModelConfig", ...)`（:301-305）

## 明确不动

- `useModelConfigRefresh` 的其余逻辑（in-flight guard、debug entry、非 codex 分支 `refreshEngineModels`）
- `app-shell.tsx:571` hook 挂接
- 全局索引文件，不执行 archive

## 风险与验收

- 风险：极低。单一调用方，行为等价（透传函数体即 `await refreshModels()`）。
- 验收：`npm run typecheck` 通过；改动文件 `npx eslint` 通过；`useModelConfigRefresh` 与 `app-shell.startup` 相关 vitest 通过。
