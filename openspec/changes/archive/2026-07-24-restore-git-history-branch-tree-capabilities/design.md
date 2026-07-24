## Context

`GitHistoryPanelView` 在有 repository summaries 时统一渲染 `GitHistoryMultiRepositoryBranchTree`。旧 navigator 仍作为 zero-repository fallback 保留，因此 capability diff 可以直接从两个 rendering path 审计。当前 catalog 已携带 `isCurrent`、`ahead`、`behind` 与完整 branch name，现有 helper/CSS 也覆盖 special badges；缺口只在新 component 的 projection。

## Goals / Non-Goals

**Goals:**

- 让 canonical repository tree 完整投影旧 navigator 的 navigation/status affordances。
- 保持 repository identity、完整 branch name 与 search/expansion state contract。
- 用 focused tests 防止后续 tree refactor 再次只迁移结构而遗漏语义。

**Non-Goals:**

- 不改变 `listGitBranches` response、Tauri IPC 或 Git operation semantics。
- 不新增跨 repository commit aggregation。
- 不抽取尚无第二个调用方的通用 branch-row component。

## Decisions

### 1. 在 canonical tree 内恢复 branch-row projection

local row 继续消费 `GitBranchListItem`，复用 `getSpecialBranchBadges` 与现有 `.git-history-branch-*` selectors。相比恢复 legacy single-repository path，该方案让 single/multi repository 永远共享一个 contract。

### 2. `All Branches` 绑定 active repository

tree 通过既有 `onSelectBranch(repositoryRoot, branchName)` 回调发送 `"all"`。这保持 commit history API 的 repository scope，不引入 aggregate backend command。没有 active repository 时禁用该入口。

### 3. 默认展开 root 与 current local groups

每个 repository 的 `__root__` local group加入初始/同步 expansion set；current branch 所属 group 继续展开。Search 仍只临时强制展开，不改写 stored expansion choice。

### 4. local 与 remote badge contract 保持旧版差异

- local：current emphasis、`HEAD`、special、ahead/behind。
- remote：special badge；不展示没有可靠语义的 ahead/behind。

## Risks / Trade-offs

- [Risk] Badge 挤压长 branch name → 复用既有 flex/ellipsis contract，branch name 收缩，badges 保持可见。
- [Risk] `All Branches` 被误解为跨仓聚合 → 入口始终携带 active `repositoryRoot`，spec/test 明确 repository-scoped。
- [Risk] root group expansion effect 反复覆盖用户折叠 → 只补充尚不存在的 identity，不删除用户已有 expansion state。

## Migration Plan

1. 补 delta spec 与 focused regression tests。
2. 修改 canonical tree projection。
3. 运行 focused Vitest、typecheck、lint 与 strict OpenSpec validation。

Rollback：回退 component/test 与本 change artifacts；backend/data 无迁移。

## Open Questions

无。
