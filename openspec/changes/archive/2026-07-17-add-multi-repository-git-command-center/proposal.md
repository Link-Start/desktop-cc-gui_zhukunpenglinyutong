## Why

当前 Git UI 将一个 workspace 建模为单一 active Git root：`ComposerBranchBadge` 只展示扁平 local branch，文件树也只能投影当前 root 的 file status。对于包含多个独立 Git 子项目的 workspace，用户无法同时识别各 repository 的 branch、同步状态与 working tree 状态，且 branch/write action 容易失去明确的 repository target。

本变更把 Git repository identity 提升为贯穿 frontend、Tauri command 与 remote daemon 的一等 contract，在不复制现有 Git History/Diff 能力的前提下，形成单仓库简洁、多仓库可导航的 Git command center。

## 目标与边界

- 自动发现 workspace root 与 bounded nested repositories，并为每个 repository 生成独立 summary。
- 文件树对 repository root folder 展示专属 icon、current branch、ahead/behind 与 working tree 摘要；repository decoration 与普通 folder changed-status 必须保持不同语义。
- 将现有 `ComposerBranchBadge` 改造成自适应 Git command center：单仓库直接展示 actions/branches，多仓库先选择 repository，再展示 repository-scoped actions/branches。
- branch list 展示 recent/local/remote hierarchy、current marker、upstream 与 ahead/behind。
- Update、Commit、Push、Create Branch、Checkout 必须作用于显式 repository target；复杂 commit/push workflow 复用现有 Git surfaces/dialogs。
- Update 必须提供可见 loading 与 success/no-op/blocked/error feedback；recent/local/remote branch sections 必须使用不含糊的独立标题。
- exact nested repository folder 的文件树右键菜单必须提供 repository-scoped Git 入口；直接操作与高风险操作统一复用既有 Git Diff/History workflows。
- repository 切换必须立即显示 loading 并拒绝重复点击；Recent/Local/Remote sections 默认折叠，搜索时自动展开匹配项。
- repository Git submenu 只保留 Commit、Add、Ignore、Diff、Compare、History、Rollback、Push、Pull、Fetch，并靠近触发菜单自适应左右展开。
- standalone root repository 必须可从文件树 root label 右键进入同一 Git submenu；nested repository 的 diff preview 必须使用正确 repository scope/path，失败时结束 loading 并显示错误。
- desktop local mode 与 remote daemon mode 保持 contract parity，并保证 macOS、Windows、Linux 路径处理一致。

## 非目标

- 不实现跨 repository 的原子 commit、批量 push 或批量 branch checkout。
- 不把 nested repositories 合并成一个虚构的 working tree。
- 不扫描 `.git`、`node_modules`、`dist`、`target`、`release-artifacts` 等已排除目录。
- 不新增第三方依赖，不重写现有 Git History、Git Diff 或 Git write workflows。

## What Changes

- 新增 bounded repository summary/read contract，返回 repository-relative path、current branch、upstream、ahead/behind、working tree counts 与 error state。
- repository-scoped Git read/write commands 接受显式 repository root，并在 backend boundary 校验路径必须位于 workspace 内且包含 Git marker。
- 扩展 branch frontend mapping，消费 backend 已有的 `localBranches`、`remoteBranches`、`currentBranch` rich fields。
- 文件树 root label 与 nested repository folder row 复用同一份 repository summary map。
- `ComposerBranchBadge` 升级为 repository-aware command center，并将 Update/Commit/Push 接入现有 Git operations/surfaces。
- 文件树 exact repository row 增加 Git submenu；通过 typed action intent 先选择 repository，再执行安全操作或打开既有确认 surface。
- repository mutation 完成后采用事件驱动刷新，并保留低频 fallback；禁止在 AppShell root chain 引入高频 polling。
- 补齐 desktop/daemon parity、path traversal、stale response、partial failure、keyboard/a11y 与跨平台路径测试。

## 方案对比与取舍

### 方案 A：切换 workspace persisted `gitRoot` 后复用所有现有 commands

改动最少，但打开菜单或执行 action 会修改全局 workspace setting，容易造成 Git Diff、Git History、文件树与并发请求间的 target race；拒绝。

### 方案 B：repository identity 作为显式 command scope，并提供聚合 summary read（采纳）

read path 通过单次 bounded aggregate command 避免 N 次 IPC；write path 始终携带显式 repository root。改动涉及 frontend/service/Tauri/daemon 多层，但 target deterministic、可测试，且不污染 persisted selection。

## Capabilities

### New Capabilities

- `multi-repository-git-command-center`: 定义 repository discovery/summary、文件树 repository decoration、自适应 command center 与 repository-scoped actions。

### Modified Capabilities

- `git-branch-management`: branch hierarchy 与 branch actions 从单一 workspace root 扩展为显式 repository scope。
- `git-workspace-branch-polling`: polling/refresh 从单 repository 状态扩展为 event-driven repository summary refresh 与低频 fallback。

## 验收标准

- 单 Git repository workspace 不增加 repository selection 层，仍可直接操作 branches。
- 多 Git repository workspace 中，每个 repository folder 显示其独立 branch、sync 与 working tree 摘要。
- multi-repo command center 先选 repository，再展示/执行该 repository 的 actions 与 local/remote branches。
- Update、Commit、Push、Checkout、Create Branch 不得作用于其他 repository。
- Update 点击后必须立即显示 loading，并显示最终结果；Recent、Local、Remote sections 不得共用 `Branches` 标题。
- nested/root repository 右键 Git submenu 只展示 Commit/Add/Ignore/Diff/Compare/History/Rollback/Push/Pull/Fetch；普通 folder 不展示 Git submenu。
- 多 repository 切换行点击后立即进入 keyed loading，完成 repository context 与 branch details 收敛后再进入详情；重复点击不得启动并发切换。
- Recent/Local/Remote sections 默认折叠；用户搜索 branch 时匹配 section 自动可见。
- nested repository diff preview 必须结束 loading，并使用 repository-relative target 加载 before/current content；错误与 stale request 必须可见且不得污染其他 repository。
- 一个损坏或无权限 repository 只降级自身 row，不阻塞其他 repositories。
- repository root path traversal、workspace 外绝对路径与非 Git 目录必须被 backend 拒绝。
- local desktop 与 remote daemon 返回相同 payload 语义；Windows separator 与 Unix separator 均可正确 normalize。
- focused frontend/Rust tests、typecheck、lint、runtime contract check 与 single-file 3000-line gate 通过。

## Impact

- Frontend：`src/features/git/**`、`src/features/composer/**`、`src/features/files/**`、AppShell/layout wiring、styles、i18n 与 tests。
- Bridge：`src/services/tauri/git.ts`、shared Git types 与 runtime contract mapping。
- Backend：`src-tauri/src/git/**`、daemon Git dispatch/implementation，以及必要的 path validation helpers。
- Behavior specs：新增 multi-repository capability，修改 branch management 与 branch polling requirements。
- Dependencies：无新增依赖。
