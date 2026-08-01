## Why

Composer 的多 repository Git command center 只能逐仓进入后执行 Update 或 Checkout；当 workspace 由多个并列 repository 组成时，用户必须重复相同操作，且容易漏仓。需要在 repository list 顶部提供 workspace-scoped 批量入口，同时保留每次 mutation 的显式 `repositoryRoot` identity。

## 目标与边界

- 在多 repository 列表顶部新增 `更新全部` 与 `切换全部分支…` 两个 keyboard-accessible actions。
- `更新全部` 使用每个 repository summary 的 current branch，串行执行已有 scoped branch update。
- `切换全部分支…` 按 repository scope 获取分支，展示至少两个仓库共有的 local / remote branches、覆盖数量与适用仓库，再仅对适用仓库串行执行已有 scoped checkout。
- 单仓失败不阻断其余仓库，结束后展示成功、失败、跳过数量与失败仓库摘要。
- mutation 完成后通过现有 aggregate repository refresh 收敛 UI state。

## 非目标

- 不提供跨 repository transaction、自动 rollback 或并发 Git mutation。
- 不创建新的 Rust/Tauri batch command，不改变现有单 repository Update、Checkout、Commit、Push 行为。
- 不自动创建缺失 branch；由现有 checkout command 决定 local/remote branch 是否可切换。

## What Changes

- 扩展 Composer Git command center 的 multi-repository root view，加入 workspace-scoped action row 和公共 branch discovery / selection 流程。
- 扩展 frontend Git branch orchestration，使 checkout 与 update 一样支持 explicit `repositoryRootOverride`。
- 增加串行 best-effort batch runner、pending dedupe、result summary 和 accessible loading/error feedback。
- 增加 focused component/hook tests 与 i18n copy。
- repository row icon 使用 deterministic、theme-safe color slots 辅助区分工程。

## 技术方案取舍

- **采用：frontend 串行 orchestration。** 复用 `updateGitBranch` / `checkoutGitBranch`，每次调用显式传入 `workspaceId + repositoryRoot`；改动最小，Desktop/daemon contract 保持不变。
- **不采用：frontend `Promise.all` 并发。** 虽然更快，但会同时启动多个 Git process，错误/进度顺序不稳定，也不符合用户定义的“循环执行”。
- **不采用：新增 backend batch command。** 会复制已有 validation、remote forwarding 与 error semantics，并扩大跨层 API 面。

## Capabilities

### New Capabilities

<!-- 无新增 capability；该变更扩展现有 multi-repository command center。 -->

### Modified Capabilities

- `multi-repository-git-command-center`: 增加 workspace-scoped Update All 与 Checkout All branch actions、串行 partial failure 语义和结果反馈。
- `git-branch-management`: branch checkout frontend orchestration 支持 explicit repository scope，并定义批量调用时的独立结果语义。

## 验收标准

- 仅在 repository count 大于 1 时显示两个全局 actions，原 repository rows 与单仓入口保持不变。
- Update All 对每个具有 current branch 的 repository 恰好调用一次 scoped update；无 current branch 的仓库被跳过。
- Checkout All 只对所选 branch 的 eligible repositories 调用 scoped checkout；其他仓库记为 skipped，一个仓库失败后继续处理剩余 eligible repositories。
- pending 期间重复触发被阻止，UI 显示 loading；结束后给出 deterministic summary。
- 同屏前 16 个 repository icon 颜色互不重复，列表顺序变化后每个 repository 的颜色保持稳定。
- focused Vitest、lint、typecheck、runtime contract checks 与 strict OpenSpec validation 通过。

## Impact

- Frontend component: `src/features/composer/components/ComposerBranchBadge.tsx`
- Frontend orchestration: `src/app-shell-parts/useAppShellGitWorkspaceOpsSection.ts`
- Prop chain: `src/features/layout/hooks/layoutNodesTypes.ts`、`src/features/layout/hooks/useLayoutNodes.tsx`
- Existing service/API: `src/features/git/hooks/useGitBranches.ts`、`src/services/tauri/git.ts`（reuse only）
- Tests and i18n: colocated Vitest suites、`src/i18n/locales/*/git.ts`
- Dependencies: none
