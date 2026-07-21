## Why

Git History repository color collision resolution 与 branch/group sorting 使用默认 `localeCompare()`，其结果依赖 OS、ICU 与用户 locale。同一 workspace 在 Windows、macOS、Linux 上可能出现颜色槽与分支顺序漂移，违反现有 deterministic repository identity contract。

## 目标与边界

- 使用与 locale 无关的 UTF-16 code-unit comparator 统一 repository、group、branch 排序。
- 保持 exact `repositoryRoot`、branch selection、Git commands 与现有 UI hierarchy 不变。
- 增加 Windows separator、大小写、Unicode 与 color collision focused tests。

## 非目标

- 不做 natural-language/numeric sorting。
- 不修改 backend path normalization、Tauri API 或 Git ref 语义。
- 不调整 palette、CSS 或 repository discovery。

## What Changes

- Git History 与 shared repository color utility 改用 locale-independent comparator。
- 锁定 Windows/macOS/Linux 对同一 repository/branch 集合的稳定排序和颜色槽。
- 补充跨平台边界测试与 OpenSpec verification evidence。

## 方案对比

- 方案 A：显式 `localeCompare(value, "en")`。仍依赖 ICU collation version，且 numeric/case rules 容易随 runtime 漂移。
- 方案 B：`<` / `>` code-unit comparator。无 locale/ICU 依赖，满足 identity ordering；选择此方案。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `git-history-panel`: 明确 repository color collision resolution 与 branch/group order 在 Windows、macOS、Linux 上必须一致。

## Impact

- `src/features/git/utils/gitRepositoryIconColors.ts`
- `src/features/git-history/components/git-history-panel/components/GitHistoryMultiRepositoryBranchTree.tsx`
- 对应 focused tests；无 dependency、API、database 或 persisted migration。

## 验收标准

- 同一组大小写、Unicode、Windows-style repository roots 在三平台获得相同 color slot mapping。
- local/remote group 与 branch rows 使用同一 locale-independent ordering。
- Git History 与 Composer focused tests、typecheck、scoped ESLint、相关 contracts 通过。
