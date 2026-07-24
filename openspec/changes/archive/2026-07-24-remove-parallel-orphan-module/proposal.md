# Proposal: remove-parallel-orphan-module

## Why

`src/features/parallel/` 目录(`types.ts` + `hooks/useParallelWorkspace.ts` + 测试,共 204 行)是一个从未接线的孤儿模块:全仓(`src/`、`scripts/`、`src-tauri/src`)零生产引用,无 barrel 导出,无路由挂载,Rust 侧无对应 command。模块名与产品中的 parallel workspace 概念相似,极易误导后来者以为它是活实现。

## What Changes

- 删除整个 `src/features/parallel/` 目录:
  - `types.ts`
  - `hooks/useParallelWorkspace.ts`
  - `hooks/useParallelWorkspace.test.ts`
- 总计 204 行纯删除,无任何生产行为变更

## Capabilities

- **New Capabilities**: 无
- **Modified Capabilities**: 无

纯死代码删除,无 requirement 级行为变更;归档时使用 `--skip-specs`。

## 目标与边界

- 目标:移除零引用孤儿模块,消除命名误导
- 边界:仅删 `src/features/parallel/` 目录;不涉及任何其他 parallel 相关概念(如 dispatchTask / feature flags,属产品决策,明确排除)

## 非目标

- 不评估 parallel workspace 产品功能的存废(该功能实现不在此目录)
- 不改动 Rust 侧任何代码(已验证无关联)

## 技术方案对比

| 选项 | 说明 | 取舍 |
|---|---|---|
| A. 整目录删除 | 目录自洽、零外部引用、无 barrel | **采用**:最小操作单元 |
| B. 保留等待接线 | 无接线计划,命名误导持续 | 放弃 |

## Impact

- **受影响文件(删除)**:`src/features/parallel/types.ts`、`hooks/useParallelWorkspace.ts`、`hooks/useParallelWorkspace.test.ts`
- **不受影响**:其余仓库文件(已验证零引用);`docs/architecture/large-file-new-file-baseline.json` 无相关条目
- **UI 影响**:无(模块从未在任何 UI 路径执行)

## 验收标准

1. `src/features/parallel/` 目录移除后 `rg "useParallelWorkspace|features/parallel" src/ scripts/ src-tauri/src` 无结果
2. `npm run typecheck` 通过
3. `npm run lint` 无新增错误
4. `npm run test` 全量通过
