## Why

统一单仓/多仓 Git History branch tree 后，新 component 只迁移了 repository hierarchy、branch selection 与 context menu，遗漏旧 navigator 的 `All Branches`、默认展开、current branch emphasis 与 branch badges。用户因此无法从左侧 tree 选择当前 repository 的全分支历史，也失去了 `HEAD`、special branch、ahead/behind 等关键状态提示。

## 目标与边界

- 在统一 `GitHistoryMultiRepositoryBranchTree` 内恢复旧 navigator 已有能力。
- 单仓与多仓共享同一 rendering contract；`All Branches` 始终限定于 active repository，不跨 repository 聚合 commit history。
- 复用现有 `GitBranchListItem` fields、`getSpecialBranchBadges` 与 CSS selectors，不修改 backend command/API。

## 非目标

- 不恢复两套独立的 single/multi repository navigator。
- 不新增跨 repository 的 aggregate commit history。
- 不调整 branch mutation、context menu 或 repository discovery lifecycle。

## What Changes

- 恢复 repository-scoped `All Branches` 入口。
- 默认展开每个 repository 的 local root group，并继续展开 current branch 所属 group。
- local branch row 恢复 current styling、`HEAD`、`MAIN`/`MASTER`/`ZH`、ahead/behind badges。
- remote branch row 恢复 special branch badge。
- 增加 focused component tests，固化 single/multi repository parity。

## 方案取舍

- **采用：在统一 tree 内复用旧 branch-row contract。** 最小 diff，数据与 CSS 已存在，避免行为漂移。
- **不采用：单仓回退 legacy tree。** 会重新形成双实现，多仓仍缺少状态提示。
- **不采用：新增 shared `BranchRow` abstraction。** 当前只有一个需要修复的 canonical component，抽象收益不足。

## 验收标准

- `All Branches` 可见、可选，并保持 active repository scope。
- local root group 与 current branch group 默认展开。
- current local branch 呈现 emphasis、`HEAD` 与适用的 special/ahead/behind badges。
- remote branch 呈现适用的 special badge。
- 既有 repository expansion、search、selection 与 context menu tests 保持通过。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `git-history-panel`: 补充分支导航的 repository-scoped all-branches、默认展开与 branch status affordance contract。

## Impact

- Frontend component: `GitHistoryMultiRepositoryBranchTree.tsx`
- Focused tests: `GitHistoryMultiRepositoryBranchTree.test.tsx`
- Behavior spec: `git-history-panel`
- API/dependency/backend: 无变更
