## Context

`ComposerBranchBadge` 已在 multi-repository root view 渲染 repository summaries，并在进入单仓后复用 `useGitBranches` 的 Update/Checkout。`updateBranch(name, repositoryRootOverride)` 已支持 explicit scope；`checkoutBranch(name)` 目前只消费 hook-selected scope。Backend `checkout_git_branch` 与 `update_git_branch` 都已支持 `repositoryRoot`，因此缺口位于 frontend orchestration，而不是 Tauri API。

约束：Git repositories 相互独立，不存在跨仓 transaction；用户明确要求“循环”更新/切换，失败后继续；AppShell root render path 不得引入高频 state 或 polling。

## Goals / Non-Goals

**Goals:**

- multi-repository root view 直接暴露 workspace-scoped Update All / Checkout All actions。
- 每次 mutation 显式携带 repository identity，串行、可去重、可归因。
- partial failure 不阻断 sibling repositories，并给出 deterministic summary。
- 复用现有 services、backend validation、daemon forwarding 和 repository refresh。

**Non-Goals:**

- 不实现跨仓 atomicity、rollback、branch auto-create 或并发 mutation。
- 不新增 backend command、dependency、polling 或 global store。

## Decisions

### 1. AppShell hook 拥有 batch orchestration

在 `useAppShellGitWorkspaceOpsSection` 增加两个 stable handlers，输入直接包含当前 `GitRepositorySummary[]`。它是现有 branch hooks、repository refresh、toast feedback 的共同 owner，能避免 component 直接调用 service。

替代方案是在 `ComposerBranchBadge` 内循环 props callbacks；这会把 domain result aggregation 与 toast policy塞进 rendering component，且无法安全刷新 aggregate summaries，因此不采用。

### 2. 串行 best-effort，结果结构化

使用普通 `for...of` 顺序执行。每个 repository 产生 `success | failed | skipped` outcome；失败捕获为 user-readable string 后继续。Component 只消费 aggregate summary，不感知 backend raw error。

替代方案 `Promise.allSettled` 延迟更低，但同时启动多个 Git process、结果顺序不稳定，不符合“循环”语义。

### 3. Checkout override 对齐 Update override

将 `useGitBranches.checkoutBranch` 扩展为 `(name, repositoryRootOverride?)`，解析规则与 `updateBranch` 一致：`undefined` 使用当前 hook scope，空字符串是显式 workspace-root repository。现有 caller 不变。

### 4. Global Checkout 使用公共 branch discovery

repository root view 点击 `切换全部分支…` 后，对每个 repository 的 exact `repositoryRoot` 并行调用已有 `listGitBranches`。Local branch 按 exact name、remote branch 按包含 remote prefix 的 exact ref（例如 `origin/main`）构建 `branch -> eligible repositories[]` coverage。至少覆盖两个仓库才属于公共分支；读取失败的仓库进入 warning，但不阻断其余仓库形成有效覆盖组。

UI 分组展示 `公共本地分支` 与 `公共远程分支`，每行显示 `eligible / total` 和适用仓库，支持 loading、搜索、折叠和 keyboard selection。选择 branch 后仍复用串行 best-effort checkout batch，但仅 mutation eligible repositories，其余仓库记为 skipped；不新增 backend command，不改变 existing checkout tracking semantics。

### 5. Pending state 和 feedback 保持 feature-local

`ComposerBranchBadge` 管理当前 global action pending/input/result presentation；AppShell hook 用 ref 防止同一 batch 重入。完成后显示汇总并保留菜单，便于用户查看失败；关闭菜单清理 transient state。

### 6. Repository 图标使用稳定差异化色槽

`ComposerBranchBadge` 根据 exact `repositoryRoot` 计算稳定 color slot，并在当前 repository 集合内做 deterministic collision resolution。同一组仓库无论展示顺序如何变化，图标颜色保持一致；前 16 个仓库使用不同的 theme-safe Tailwind color class。该颜色仅用于视觉区分，不承载 clean/dirty/error 等 Git status 语义。

## Risks / Trade-offs

- [Risk] 后续仓库失败会留下前面仓库已成功的 partial state → 明确 best-effort contract，逐仓 outcome 汇总，不伪装 atomic success。
- [Risk] 仓库没有 current branch，Update All 无合法 target → 标为 skipped，不调用 mutation。
- [Risk] checkout 被 dirty worktree 阻止 → 复用 backend error，继续 sibling repositories，显示失败仓库。
- [Risk] 某仓 branch list 读取失败会降低已知 coverage → 标出失败 repository，仅基于成功读取且至少两个仓库共有的分支继续，不把未知仓库算作 eligible。
- [Risk] 各仓使用不同 remote alias → remote ref 使用 exact name 求交集；不猜测 `origin` 与其他 alias 等价。
- [Risk] 每次 mutation 都触发 branch/repository refresh，产生重复请求 → scoped mutation handler仅执行 command；batch 结束统一 aggregate refresh，避免每仓刷新。
- [Risk] AppShell props 扩散导致 render churn → callbacks 使用 `useEventCallback`，branchControl 继续由现有 `useMemo` 稳定。
- [Risk] repository 数量超过可辨识色板容量 → 超过 16 个后允许复用色槽；repository name 与 status token 继续提供完整 identity/状态信息。

## Migration Plan

1. 扩展 frontend hook signature，保持 legacy callers compatible。
2. 增加 AppShell batch handlers 和 typed result。
3. 传入 Composer branch control，添加 global action UI/i18n/tests。
4. focused tests、typecheck、lint、runtime contract 与 strict OpenSpec validation。

Rollback 时删除新增 props/handlers/UI；既有 scoped command signatures 可保留 optional override，不构成 breaking change。

## Open Questions

无。失败策略已确认采用“记录失败、继续其余仓库、最终汇总”。
