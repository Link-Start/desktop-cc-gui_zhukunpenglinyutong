## Why

多 repository Git command center 在 summary refresh 暂时返回空集合时会清除当前 repository selection，进而卸载 branch query 并让分支列表短暂消失；同时 branch path scope 目前只是静态文字，无法像顶层 Recent / Local / Remote 一样折叠。文件树 Git submenu 还暴露了本轮不需要的 compare/diff/rollback 入口，却缺少直接更新所点 repository 当前分支的能力。

## 目标与边界

- 保持 repository 与 branch 的 last-known-good projection，不让单次瞬时空响应造成菜单闪空。
- 为 local/remote branch scope 增加一层独立折叠，搜索时临时展开匹配 scope。
- 精简 exact repository folder/root 的 Git submenu，并复用现有 scoped branch update command。
- Update 必须携带显式 `repositoryRoot` 与该 repository 的 `currentBranch`，并提供 loading 与结构化结果反馈。

## 非目标

- 不新增或修改 Rust/Tauri Git command。
- 不实现任意深度的 branch tree；本轮只在顶层 section 下增加一层 scope 折叠。
- 不改变 Git History 中现有 branch context menu、pull/push/fetch dialog 或 branch update 语义。
- 不引入新依赖，不重构完整 Git command center。

## 方案对比与取舍

### 方案 A：每次 summary 变化都立即重置 selection

实现最直接，但把 transient empty、loading 与 confirmed empty 混为一谈，正是当前分支列表闪烁的根因；拒绝。

### 方案 B：保留 last-known-good selection，并只在确定的新非空集合或 workspace 切换时重置（采纳）

该方案不改变 backend contract，能阻断 summary polling 对 branch state 的级联清空。真实 workspace 切换仍立即清理；repository 集合恢复后继续校验选中项。

Update 采用现有 `updateGitBranch(workspaceId, branchName, repositoryRoot)`，而不是先修改 persisted `gitRoot` 再依赖异步 UI state，避免 target race。

## What Changes

- repository summary 单次空结果不再清除已选 repository 与 branch projection。
- Local/Remote 内层 scope header 改为独立可折叠 button；菜单关闭时重置，branch 搜索时临时展开。
- 文件树 Git submenu 删除 Show Diff、Compare Revision、Compare Branch/Tag、Rollback。
- 文件树 Git submenu 新增 Update，使用 clicked repository summary 的 `currentBranch` 与 `repositoryRoot` 调用既有能力。
- Update 在 detached/unborn/unavailable/no-current-branch 状态下禁用，并显示 success/no-op/blocked/error feedback。
- 补齐 transient empty、scope collapse/search、menu composition 与 scoped update regression tests。

## Capabilities

### New Capabilities

- `git-command-center-branch-menu-stability`: 定义 command center 分支 projection 稳定性、二级 scope 折叠与 repository submenu Update 行为。

### Modified Capabilities

- `git-branch-management`: branch hierarchy 增加一层可折叠 scope，并要求 repository-scoped Update 继续使用显式 target。
- `git-workspace-branch-polling`: summary refresh 的 transient empty 不得级联清空 last-known-good branch projection。

## 验收标准

- 一次 repository summary 空响应后，当前 repository selection 与 branch rows 保持可见；后续有效响应正常收敛。
- Local 与 Remote scope 可独立展开/收起，搜索匹配 branch 时对应 scope 自动可见。
- repository Git submenu 不再出现四个被移除动作，并出现 Update。
- Update 只更新所点击 repository 的当前分支，重复点击被阻止，结果反馈明确。
- detached/unborn/unavailable repository 不执行 Update。
- focused Vitest、typecheck、lint、runtime contract check 与 strict OpenSpec validation 通过。

## Impact

- Frontend state/controller：`src/features/git/hooks/useGitRepositories.ts`、AppShell Git workspace wiring。
- UI：`src/features/composer/components/ComposerBranchBadge.tsx`、`src/features/files/components/FileTreePanel.tsx`。
- Typed action intent/layout contract 与对应 tests。
- Backend/service contract 无变化；依赖无变化。
