## Why

当前 Git History 左侧 branch navigator 只表达单个 repository 的 local/remote branches。多仓 workspace 虽然能通过顶部 repository picker 切换作用域，但无法同时看见所有 repository，也无法从 branch tree 直接判断或切换目标仓库，导致多仓浏览需要反复打开下拉菜单。

## 目标与边界

- 多仓模式将左侧 branch navigator 改为 `local/remote -> repository -> branch` 的完整树形结构。
- 所有 repository 的 branch catalog 并行加载，单仓失败只影响对应 repository row。
- repository 支持独立展开；点击 branch 会原子地切换 repository scope 与 Git History branch filter。
- repository 内 branch 继续按既有 Git scope 语义分组折叠：local 按 `/` 首段，remote 按 remote name。
- 单仓与多仓模式共用同一 branch navigator；单仓按只有一个 repository row 的树展示，不改变 repository-scoped Git command 行为。

## What Changes

- Git History 多仓左栏展示稳定着色的 repository rows，并在 local/remote section 下分别展开 scoped branches。
- repository 展开后先展示可折叠 branch groups，再展示保留完整 identity 的 branch leaves。
- 存在 repository tree 时隐藏顶部重复的 repository picker；project picker 与 toolbar actions 保持现状。
- branch search 同时过滤 repository name 与 scoped branch name。
- branch catalog load 使用 stale-request guard 与 partial-failure settlement，避免一个损坏仓库清空整棵树。
- 增加 single/multi-repository rendering、expansion、search、selection 和 partial failure regression tests。

## 方案对比

### 方案 A：仅复用当前 selected repository branches

- 优点：改动最小，不增加 branch discovery 请求。
- 缺点：无法同时展开多个 repository，search 也不能覆盖完整 workspace，不满足“做全”。

### 方案 B：前端并行加载全部 repository branch catalogs（采用）

- 优点：复用现有 `listGitBranches(workspaceId, repositoryRoot)` contract，无 backend/API 变更；支持完整树、跨仓 search 与 partial failure。
- 缺点：打开 Git History 时会产生 N 个 repository-scoped branch read；通过仅在多仓模式启用、并行 settlement 与 stale guard 控制影响。

### 方案 C：新增 backend aggregate branch-tree command

- 优点：一次 IPC 返回完整结果，可由 backend 控制并发。
- 缺点：引入 cross-layer contract 与 daemon parity 工作，当前需求没有必要。

## 验收标准

- 多仓 workspace 同时显示 `本地`、`远程` sections 与全部 repository rows。
- local/remote repository rows 可以独立、多选展开，并显示精确 repository-scoped branches。
- local branch 的 root/prefix groups 与 remote name groups 可独立折叠；当前 local branch group 自动展开。
- 点击任意 repository branch 后，中间 commit graph、右侧 worktree/details 使用该 repository scope。
- 任意单仓 branch discovery 失败时，其他仓库仍可展开、搜索和选择。
- repository icon color 稳定且在当前 palette 容量内互不相同。
- 单仓 Git History 使用与多仓相同的 `local/remote -> repository -> branch` DOM，仅渲染一个 repository row。

## 非目标

- 不新增或修改 Rust/Tauri commands。
- 不实现跨 repository 的合并 commit graph。
- 不改变 checkout/create/rename/delete/merge 等 mutation semantics。
- 不改变 Git History 三栏尺寸、toolbar 或右侧 changed-file tree。

## Capabilities

### New Capabilities

<!-- None. -->

### Modified Capabilities

- `git-history-panel`: 增加多仓 branch navigator 的完整 repository tree、partial failure 和 repository-scoped selection 行为。

## Impact

- Frontend: `src/features/git-history/components/git-history-panel/**`、`src/styles/git-history*.css`、相关 tests/i18n。
- Shared utility: repository icon color slot 分配逻辑从 composer-local 提升为 Git feature utility，供 Composer 与 Git History 复用。
- API/dependency/backend: 无变更。
