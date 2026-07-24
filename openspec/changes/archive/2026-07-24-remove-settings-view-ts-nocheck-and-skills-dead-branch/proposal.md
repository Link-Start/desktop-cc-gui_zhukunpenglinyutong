## Why

`src/features/settings/components/SettingsView.tsx` 是 settings feature 仅剩的壳子热文件：叶子模块 `settings-view/` 子目录已全部 typed，但该文件第 1 行仍挂 `// @ts-nocheck`，导致整个 2687 行壳子脱离 typecheck 保护。同时文件内残留一个恒为 false 的 `activeSection === "skills"` 死分支（约 :2460）：`SettingsViewSection` union（`settings-view/settingsViewAppearance.ts:4-20`）不含 `"skills"`，curated skills 已迁移到 MCP section 的 skills subtab（:936 / :2374），该分支不可达且持续制造死引用。

2026-07-24 实测：摘除 `@ts-nocheck` 后 `tsc` 在该文件仅报 6 个 error（多为 TS6133/TS6196 unused 级），治理成本已足够低，适合 P0 闭环。

## 目标与边界

- 目标：删除 SettingsView 中不可达的 skills section 死分支（含死引用清理），修复本文件残余的 6 个 `tsc` error，最终摘除 `@ts-nocheck`，使该文件回到全量 typecheck 保护。
- 边界：只改 `src/features/settings/components/SettingsView.tsx` 单文件；不改 `settings-view/` 子组件的 props 契约（进行中 change `add-vendor-cli-lifecycle-header` 在同域工作）；不改任何用户可见交互。

## 非目标

- 不重构 SettingsView 周边代码、不拆分该文件。
- 不修改 MCP skills subtab（`mcpManagementSubTab === "skills"`，:936 / :2374-2375）这条 live 路径。
- 不顺手修复邻近文件或子组件中发现的其它问题，只记录报告。
- 不处理 `stabilize-client-runtime-and-diagnostics` 记录的 `SettingsView.test.tsx` stale 期望（2026-07-24 复跑 52/52 通过，该记录疑似已过时，仅记录不扩大改动面）。

## What Changes

- 删除 `activeSection === "skills"` 不可达渲染分支（:2460-2473）及其死引用。
- 修复本文件内 6 个残余 `tsc` error（unused import / unused declaration 级），不触碰子组件契约。
- 摘除文件第 1 行 `// @ts-nocheck`。
- 用 `tsc --noEmit` 全量 typecheck 与 SettingsView 定向测试验证行为未漂移。

## Capabilities

### New Capabilities

- `settings-view-type-safety`: 约束 SettingsView 壳子文件必须保持 typed（无 `@ts-nocheck`）且不含不可达 section 分支，治理过程不扩大改动面、不改子组件 props 契约。

### Modified Capabilities

- None.

## Impact

- Affected code:
  - `src/features/settings/components/SettingsView.tsx`（唯一改动文件）
- Affected workflow:
  - 无行为变更；settings 各 section 渲染路径保持现状。

## 验收标准

- `npm run typecheck`（`tsc --noEmit`）全量通过，SettingsView.tsx 无 `@ts-nocheck`。
- `activeSection === "skills"` 死分支及其死引用从文件中移除；MCP skills subtab live 路径不受影响。
- `npx vitest run src/features/settings/components/SettingsView.test.tsx` 通过。
- 治理分三个独立可合的 commit：删死分支、修残余 error、摘 `@ts-nocheck`。
