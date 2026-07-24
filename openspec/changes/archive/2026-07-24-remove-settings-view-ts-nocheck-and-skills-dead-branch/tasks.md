## 1. 死分支清理

- [x] 1.1 [P0, depends: none] 删除 SettingsView.tsx 中 `activeSection === "skills"` 不可达渲染分支（:2460-2473）及随之产生的死引用，保持 `@ts-nocheck` 在位；验证 typecheck 与 SettingsView 定向测试通过。（2026-07-24 完成：分支删除后 `SkillsSection` / `CuratedSection` import 仍被 MCP skills subtab live 路径使用，无新增死引用；typecheck + 52/52 定向测试通过）

## 2. 残余类型错误修复

- [x] 2.1 [P0, depends: 1.1] 临时摘除 `@ts-nocheck` 复测，枚举本文件残余 `tsc` error（预期 6 个，TS6133/TS6196 unused 级），逐一在本文件内修复，不改 `settings-view/` 子组件 props 契约。（2026-07-24 实测：死分支清理后剩余 5 个 error，全部为 TS6133 unused import：`ChevronDown`、`ChevronUp`、`Trash2`、`getDefaultInterruptShortcut`、`SessionRadarHistoryDeleteResult`；均在本文件内删除 import 修复，未触碰任何子组件契约）
- [x] 2.2 [P0, depends: 2.1] 若任一 error 必须改子组件契约才能修复，停止并在报告中说明，不硬改。（未触发：5 个 error 均为文件内 unused import）

## 3. 摘除 ts-nocheck 与验证

- [x] 3.1 [P0, depends: 2.1] 摘除 SettingsView.tsx 第 1 行 `// @ts-nocheck`，`npm run typecheck` 全量通过。（2026-07-24 通过；期间并行代理的 `src/features/vendors/types.ts` 工作区编辑曾瞬时造成全量 tsc 失败，与本 change 无关，其修复后复测 exit 0）
- [x] 3.2 [P0, depends: 3.1] 运行 SettingsView 定向测试（`npx vitest run src/features/settings/components/SettingsView.test.tsx`）通过；与 `stabilize-client-runtime-and-diagnostics` 记录的 stale 期望冲突时以不扩大改动面为原则处理并记录。（2026-07-24 复跑 52/52 通过；未观察到该 verification 记录的 stale `Client UI visibility` 期望失败，该记录疑似已过时，未做任何测试改动）
- [x] 3.3 [P0, depends: 3.2] 三个 commit 独立可合（删死分支 / 修残余 error / 摘 `@ts-nocheck`）；运行 `openspec validate --strict` 通过后归档。（commit：`29ef72543` / `37d545f4f` / `b1a2ea4a5`，另前置提案 commit `71ab03f58`）
