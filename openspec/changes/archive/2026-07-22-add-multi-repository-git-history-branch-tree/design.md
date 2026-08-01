## Context

Git History 已通过 `repositories`、`selectedRepositoryRoot` 和 `onSelectRepository` 支持 repository-scoped history、status、diff 与 mutation。当前 UI 将 repository selection 放在 top toolbar，左栏只渲染 selected repository 的 `branches` state。现有 `listGitBranches(workspaceId, repositoryRoot)` 已提供精确 scoped local/remote branch catalog，因此无需扩展 Rust/Tauri contract。

多仓 workspace 常包含 10–30 个 repository。新树必须完整但不能把每个 repository 的 branch catalog 混进 Git History 主 state，否则 branch mutation 和 commit filter 容易失去 selected repository identity。

## Goals / Non-Goals

**Goals:**

- 多仓模式渲染 `HEAD -> local/remote -> repository -> branch` navigator。
- branch catalogs 并行读取、独立 settlement，并使用 request identity 防止 workspace/repository list 切换后的 stale overwrite。
- 多个 repository row 可独立展开；search 与 click 保留精确 repository identity。
- 单仓与多仓复用同一 repository branch tree component；单仓用唯一 repository 作为 effective active root。

**Non-Goals:**

- 不聚合多个 repository 的 commit DAG。
- 不修改 Git operations、Tauri command signatures 或 daemon parity contract。
- 不把多仓 tree state 提升到 AppShell/root state。

## Decisions

### 1. 使用 feature-local hook 管理只读 branch catalogs

新增 `useGitHistoryRepositoryBranchCatalogs`。输入只包含 `workspaceId`、repository summaries 与 `enabled`；输出 keyed by exact `repositoryRoot` 的 loading/success/error entries。

- 独立请求通过 `Promise.allSettled` 并发启动，消除串行 waterfall。
- effect 使用 monotonic request id；workspace 或 repository identity set 变化后，旧结果不得提交。
- catalog state 与 selected repository 的 canonical `branches` state 分离。前者只服务 navigator，后者继续驱动 mutation、current branch 与 commit query。

Alternatives：复用 selected repository branches 不能支持完整 tree；新增 aggregate backend command 超出当前边界。

### 2. Repository tree 独立组件，不继续扩大 view renderer

新增 `GitHistoryMultiRepositoryBranchTree`，只负责 presentation、expanded repository sets、query filtering 与 scoped selection callback。它接收 normalized catalogs，不直接调用 Tauri。单仓与多仓共用该 component；命名保留为变更历史标识，不代表运行时仅限多仓。

- local/remote section expansion 保持独立。
- repository rows 在两类 section 中共享 stable color slot。
- expanded repository state 使用 `Set<string>`，local/remote 用不同 key namespace。
- query 命中 repository name 时保留该 repository；命中 branch name 时自动展示匹配 branch，不修改用户持久展开状态。
- 当 `selectedRepositoryRoot` 为 `null` 且只有一个 repository 时，以唯一 `repositoryRoot` 作为 effective active root，保证空字符串 root 也能展开、显示 HEAD 并精确触发 branch callback。
- repository 内复用既有 branch grouping semantics：local 通过 `getBranchScope` / `getBranchLeafName` 按首个 `/` 分成 root 与 prefix groups；remote 按 `branch.remote` 分组并去除 remote prefix 展示 leaf。
- branch group expansion 使用 exact `scope + repositoryRoot + groupKey` identity；当前 local branch group 默认展开，search 临时展开命中 group，不覆盖用户展开状态。

Alternatives：直接堆入 `GitHistoryPanelView.tsx` 会继续放大已有 oversized renderer 并让测试难以聚焦。

### 3. Branch selection 复用现有 repository scope callback

tree 回调携带 `{ repositoryRoot, branchName }`。view 在 repository identity 变化时先等待 `onSelectRepository(repositoryRoot)` 完成，再调用 `setSelectedBranch(branchName)` 或打开 branch context menu。现有 history load effect 因而只使用匹配的新 repository root 与 branch filter 读取 commit graph。

repository row expand 是 read-only UI 行为，不切换 active Git scope；只有 branch selection 才切换 repository。这样允许同时展开多个 repository 而不会因浏览树改变 toolbar mutation target。

### 4. 提升 repository color utility 到 Git feature 层

现有 Composer 已有 deterministic 16-slot palette。将纯 utility 移到 `src/features/git/utils/`，Composer 与 Git History 共同引用，避免复制 hash/color policy。颜色只辅助识别，repository name 与 selection state 仍是语义来源。

## Risks / Trade-offs

- [Risk] 多仓打开时产生 N 个 local Git reads → 仅在 `repositories.length > 1` 启用并行 catalog hook；单仓复用 canonical branch state，避免重复 Git read。
- [Risk] 单仓损坏导致整体 Promise rejection → `Promise.allSettled` + row-local error，其他 catalogs 保留。
- [Risk] workspace 快速切换产生 stale result → request id guard 丢弃旧 settlement。
- [Risk] repository list reorder 导致颜色跳变 → stable identity hash + collision-aware slot assignment。
- [Risk] tree 与 canonical selected branches 暂时不同步 → tree catalogs 保持只读；既有 `refreshAll` 在刷新 canonical state 后递增 `refreshKey`，统一重载各仓 catalog，不改变 mutation command lifecycle。

## Migration Plan

1. 提升并复用 repository color utility。
2. 加入 catalog hook 与 pure presentation component。
3. single/multi-repository condition 共用 repository tree；仅零 repository 时保留 legacy fallback。
4. focused tests 验证 multi/single、empty-root selection、search、partial failure、stale guard。
5. 在 repository row 内增加 branch group rows，并验证 local prefix、remote name、独立折叠与完整 branch callback。

Rollback：删除 multi-repository conditional branch，恢复 toolbar repository picker；无 persisted data 或 backend migration。

## Open Questions

无。用户已确认完整 local/remote repository tree、多仓同时展开，以及单仓按单个 repository row 复用同一 UI。
