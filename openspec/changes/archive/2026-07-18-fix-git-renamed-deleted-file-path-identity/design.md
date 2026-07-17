## Context

`get_git_status` 同时开启 `renames_head_to_index` 与 `renames_index_to_workdir`，但 Desktop 与 daemon 都读取 `StatusEntry.path()`。git2 在 rename status 上返回 old/source path，因此 backend 虽输出 `status: "R"`，唯一 `path` 却指向已从 working tree 消失的文件。

该错误跨越 Rust DTO、Tauri/daemon payload、React status model 与 Git row activation。multi-repository 已正确保留 `repositoryRoot`，但 repository 内部 file identity 仍错误，所以 single/multi 都会失败。

约束：

- `GitFileStatus.path` 被大量 selection、mutation、preview 与 file-open caller 使用，不能做 breaking rename。
- remote daemon payload 由同一 TypeScript contract 消费。
- 当前 worktree 存在大量他人文档改动，本 change 只新增自己的 artifacts，并只修改 Git 相关代码/tests。

## Goals / Non-Goals

**Goals:**

- `R` status 的 canonical `path` 始终是 destination/current path，optional `oldPath` 保存 source path。
- `D` status 保留可用于 diff/mutation 的 historical path，但不进入 ordinary workspace editor。
- indexed/workdir status 各自从正确的 libgit2 delta 取 identity。
- working-tree diff、stats 与 full-diff 复用同一 rename-aware path set。
- single/multi repository 与 Desktop/daemon 行为一致。
- additive payload 对缺少 `oldPath` 的旧数据保持兼容。

**Non-Goals:**

- 不新增 rename UI、old → new 文案或颜色。
- 不自定义 Git diff similarity threshold，不改变 commit history rename-follow 或文件树 decoration。
- 不引入新 command 或 dependency。
- 不处理其他 OpenSpec/README/main spec 改动。

## Decisions

### 1. 保留 `path`，新增 optional `oldPath`

`path` 继续是所有现有 caller 的 canonical key：

- rename：destination/current path；
- added/modified/typechange/untracked：现有 current path；
- deleted：historical/deleted path，因为不存在 current file；
- `oldPath`：仅在 rename old/new 不同时出现。

相比新增并强制迁移 `currentPath + previousPath`，该方案是 additive contract，现有 caller 自动获得正确 rename path，只有需要历史 identity 的 consumer 才读取 `oldPath`。

### 2. 在 shared Rust helper 中解析 status-layer identity

新增 shared resolver，输入 `StatusEntry` 与 layer：

- index layer 读取 `head_to_index()`；
- workdir layer 读取 `index_to_workdir()`；
- rename 优先 `new_file.path()`；
- deleted 优先 `old_file.path()`；
- delta 缺失时回退 `StatusEntry.path()`，保持 degraded compatibility。

Desktop 与 daemon 都调用该 resolver，避免两套 rename 判断继续 drift。aggregate `files` 优先 workdir identity，再回退 index identity。

### 3. rename mutation path expansion 复用 shared helper，并显式选择 layer

现有 Desktop 已把 rename source/destination 展开后执行 stage/unstage/discard，daemon 尚未保持 parity。将该 helper 下沉到 shared Rust module，两端都使用相同 old/new path set。

helper 接收 `GitStatusLayer` intent：

- stage/discard 只解析 Workdir identity；
- unstage 只解析 Index identity；
- 对目标 layer 未找到 rename 时退化为原始 target，不借用另一 layer 的 rename pair。

这不是新增 mutation 能力，而是保护 `path` 改为 destination 后的既有 action semantics，并避免 `HEAD a → Index b → Workdir c` 时 Workdir-first lookup 污染 unstage。

### 4. deleted activation 复用现有 modal preview

普通 `onOpenFile` 只能读取 workspace current file。`D` 没有 current file，因此 row activation 不再调用该 callback，而是调用现有 `onOpenFilePreview`：

- single repository 直接使用现有 `diffEntries`；
- multi repository 继续按 `repositoryRoot` 加载 scoped diff；
- `WorkspaceEditableDiffReviewSurface` 已有 `status === "D"` read-only gate。

不新增 deleted snapshot editor，也不改变显式 inline/modal preview buttons。

### 5. frontend canonical model 保留 optional identity

shared TypeScript `GitFileStatus` 增加 `oldPath?: string | null`；`DiffFile` 直接复用该 type，减少平行 DTO。status equality 与 canonical copy 同步比较/normalize `oldPath`，避免 polling 因 identity 变化漏更新。

### 6. libgit2 diff 在消费前完成 rename detection

`diff_tree_to_workdir_with_index` 只生成 raw delta；它不会自动执行 similarity pairing。Desktop/daemon 在遍历 delta 前统一调用 `Diff::find_similar`，启用 `renames(true) + for_untracked(true)`，让未 staged rename 的 untracked destination 也参与 pairing；不引入自定义算法。

stats/full-diff 使用同一次 diff 中的 source + destination pathspec；对于 chained rename，preview alias resolver 收集与 target 连通的 Index/Workdir identities。canonical frontend projection 因而只接收一个 `R` row，不再从 raw old-path delete 合成 fallback。

### 7. row activation 统一 mouse 与 keyboard 入口

single-repository section 接收 `(path, section)` activation callback。ordinary mouse click 完成 selection 后调用它，Enter/Space 直接调用同一 callback；modifier click 仍只负责 multi-selection。该 callback 是 `R` editor target 与 `D` read-only preview 的唯一分支点。

## Risks / Trade-offs

- [Risk] libgit2 similarity detection 增加一次 diff scan。
  → Mitigation：复用 libgit2 内建 `find_similar`，不增加额外 repository walk；现有 preview file/byte budget 保持不变。

- [Risk] staged rename 与 unstaged rename chain 可能拥有不同 destination。
  → Mitigation：分别读取 head-to-index 与 index-to-workdir delta；禁止继续复用单个 `StatusEntry.path()`。

- [Risk] optional payload 被旧 frontend 忽略。
  → Mitigation：`path` 本身已改为 canonical destination，`oldPath` 仅补充历史 identity。

- [Risk] deleted row 改为 modal preview会改变普通点击落点。
  → Mitigation：ordinary editor 对 deleted 没有合法 target；复用既有 read-only surface 是可收敛的最小行为。

## Migration Plan

1. 先增加 additive DTO/helper 与 Rust tests。
2. Desktop/daemon status 和 mutation 接入 shared helper。
3. frontend type/canonical equality 接收 `oldPath`。
4. single/multi deleted activation 接入既有 preview。
5. Desktop/daemon diff 启用 rename detection，stats/full-diff 使用 rename aliases。
6. mutation resolver 增加 Index/Workdir intent，single-repository activation 合并 mouse/keyboard path。
7. 运行 focused tests、typecheck、runtime contract 与 strict OpenSpec validation。

Rollback 可按相反顺序移除 frontend routing、shared helper 使用及 optional field；无 persisted data migration。

## Open Questions

无。自定义 similarity policy 与 old → new UI 展示明确留作独立需求；本 change 仅启用 libgit2 内建 rename detection。
