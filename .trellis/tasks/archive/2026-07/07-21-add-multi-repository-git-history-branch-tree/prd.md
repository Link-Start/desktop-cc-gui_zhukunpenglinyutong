# Multi-Repository Git History Branch Tree

## Goal

将 Git History 左栏统一为完整 `local/remote -> repository -> branch` tree：多仓展示全部 repositories，单仓展示唯一 repository，同时保持 Git mutation contract 不变。

## Requirements

- OpenSpec change: `add-multi-repository-git-history-branch-tree`。
- 多仓 local/remote sections 均展示全部 repositories。
- repositories 可独立、多选展开，并显示 exact repository-scoped branches。
- repository 内 local branches 按 root/首段 prefix 分组，remote branches 按 remote name 分组；groups 可独立折叠。
- branch catalogs 并行加载；单仓 failure 不影响 sibling repositories。
- 点击 branch 同步 repository scope 与 Git History branch filter。
- repository icons 使用 stable distinct palette。
- search 覆盖 repository names 与 scoped branches，并临时展开命中的 section/repository/group。
- 跨仓 branch context menu 必须等待 repository identity 切换完成后再开放 action。
- 存在 repository tree 时隐藏重复 toolbar repository picker。
- single-repository mode 复用同一 tree，以唯一 repository 解析 `null` / empty-root selection。

## Acceptance Criteria

- [x] 两个以上 repositories 时显示完整 local/remote repository tree。
- [x] 多个 repository rows 可同时保持展开。
- [x] repository 内 branch groups 可独立折叠，当前 local branch group 默认展开。
- [x] local/remote children 不串仓、不串 category。
- [x] scoped branch click 刷新 commit graph、worktree 与 commit details repository root。
- [x] partial failure 显示 row-local error，成功 rows 继续工作。
- [x] repository/branch search 保留 exact scope。
- [x] 单仓显示唯一 repository row，并通过 focused regression。
- [x] lint、typecheck、runtime contracts 与 strict OpenSpec validation 通过。
- [x] 用户验收前不执行 git commit。

## Definition of Done

- Implementation、tests、i18n、styles 与 OpenSpec verification evidence 完整。
- 不新增 dependency、backend command 或 persisted migration。
- 工作区保留未提交，交由用户 UI 验收。

## Technical Approach

- 多仓使用 feature-local catalog hook 并行读取全部仓库；单仓复用 canonical branch state，避免重复 Git read。
- 使用独立 presentation component 管理 section/repository expansion 与 filtering。
- canonical selected repository branch state 继续由现有 `GitHistoryPanelImpl` 管理。
- 将 Composer repository color utility 提升到 shared Git feature utility。

## Decision (ADR-lite)

**Context**: selected-repository-only data 无法支撑完整多仓树；backend aggregate command 会扩大 cross-layer scope。

**Decision**: frontend parallel catalogs + exact repository identity + partial settlement。

**Consequences**: 多仓 panel open 会产生 N 次 local branch reads，但只在 Git History 多仓模式发生；stale guard 与 `Promise.allSettled` 保证一致性。

## Out of Scope

- 多仓 commit DAG aggregation。
- Git mutation semantics 变化。
- Rust/Tauri/daemon API 变化。
- Git History toolbar、right detail tree 或 panel sizing redesign。

## Technical Notes

- Primary files: `GitHistoryPanelImpl.tsx`, `GitHistoryPanelView.tsx`, `git-history.part1.css`, `GitHistoryPanel.test.tsx`。
- Existing scoped API: `listGitBranches(workspaceId, repositoryRoot)`。
- Existing repository identity: `GitRepositorySummary.repositoryRoot`，包括 root repository 的 exact empty string。
