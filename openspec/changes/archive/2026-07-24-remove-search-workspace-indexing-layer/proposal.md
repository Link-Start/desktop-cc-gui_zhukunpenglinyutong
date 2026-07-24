# Proposal: remove-search-workspace-indexing-layer

## Why

`src/features/search/indexing/` 目录包含两代索引实现:`messageIndex.ts`(现行,被 `messageProvider.ts:2` 生产引用)与 workspace 级增量索引层(`buildWorkspaceIndex.ts`/`syncWorkspaceIndex.ts`/`indexItem.ts`)。后者构成一个自洽但从未接入生产的子系统:除目录内部互相引用外,全仓(含 `scripts/`、`src-tauri/src`)无任何生产引用。上一轮"整目录纯死代码"的判断已被证伪(`messageIndex.ts` 是活的),本轮精确定位死子集。

## What Changes

- 删除 workspace 增量索引层 3 个源文件:
  - `src/features/search/indexing/buildWorkspaceIndex.ts`
  - `src/features/search/indexing/syncWorkspaceIndex.ts`
  - `src/features/search/indexing/indexItem.ts`
- 删除 5 个仅覆盖上述死代码的测试:
  - `buildWorkspaceIndex.test.ts`、`syncWorkspaceIndex.test.ts`、`indexItem.test.ts`
  - `equivalence.regression.test.ts`、`invalidation.regression.test.ts`
- **保留** `messageIndex.ts` + `messageIndex.test.ts`(`messageProvider.ts` 生产在用)
- 总计约 780 行纯删除,无任何生产行为变更

## Capabilities

- **New Capabilities**: 无
- **Modified Capabilities**: 无

纯死代码删除,无 requirement 级行为变更;归档时使用 `--skip-specs`。

## 目标与边界

- 目标:移除从未接线的 workspace 增量索引层,消除"search 有两套索引"的认知噪音
- 边界:仅删目录内自洽死子集;`messageIndex.ts` 及其测试原样保留

## 非目标

- 不改动 `messageProvider.ts` 的搜索行为(全局搜索 UI 结果不变)
- 不处理 semanticRetrieval 半成品接线(独立决策议题)
- 不评估"未来是否要启用 workspace 索引"(若未来需要,git 历史可恢复)

## 技术方案对比

| 选项 | 说明 | 取舍 |
|---|---|---|
| A. 删除死子集保留 messageIndex | 死子集引用闭包目录内自洽,可安全剥离 | **采用** |
| B. 整目录删除 | `messageIndex.ts` 被 `messageProvider.ts` 生产引用 | 放弃:会打断全局搜索 |
| C. 保留等待接线 | 无接线计划,保留即腐化源 | 放弃 |

## Impact

- **受影响文件(删除)**:上述 3 源文件 + 5 测试
- **不受影响**:`messageProvider.ts`(仅 import `messageIndex`)、`messageIndex.test.ts`(仅 import `./messageIndex`)、`docs/architecture/large-file-new-file-baseline.json`(无相关条目)
- **UI 影响**:无(死子集从未在任何 UI 路径执行;全局搜索继续走 `messageIndex`)

## 验收标准

1. 8 个文件移除后 `rg "buildWorkspaceIndex|syncWorkspaceIndex|indexItem" src/ scripts/` 无结果
2. `npm run typecheck` 通过
3. `npm run lint` 无新增错误
4. `npm run test` 全量通过
5. 手动 smoke:全局搜索(搜索面板消息搜索)正常返回结果
