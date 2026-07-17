## Why

Git status 将 rename 识别为 `R` 后，当前 payload 仍把 source/old path 填进唯一的 `path` 字段；Git 面板随后把这个已不存在的路径交给 workspace file reader，导致紫色 rename 文件长期停在 loading。deleted file 同样没有可写 current file，却仍可能进入普通 editor open flow。

## 目标与边界

- 为 working-tree change 建立明确的 current/previous path identity：`path` 表示当前可操作路径，rename 额外携带 optional `oldPath`。
- single-repository 与 multi-repository 共用同一 identity contract，并保持 `workspaceId + repositoryRoot` scope 不变。
- Desktop Tauri 与 daemon/Web Service status payload 保持 parity。
- rename 行打开当前文件；deleted 行进入既有 read-only diff preview，不请求不存在的 workspace file。
- 保持 stage/unstage/discard 对 rename old/new path 的完整 mutation 语义。
- rename status、diff、stats 与 full-diff 使用同一双路径 identity，避免同一 rename 被投影为 `R + D` 两行。
- mouse click 与 keyboard activation 使用同一 `R/D` 路由语义。
- staged + unstaged chained rename 按 command intent 选择正确的 Index/Workdir layer。

## 非目标

- 不调整 Git 面板颜色、文件列表布局或 status 字母含义。
- 不重做 Git diff renderer、commit history 或自定义 rename similarity 算法；仅启用 libgit2 内建 rename detection。
- 不整理、同步或归档其他 OpenSpec change，也不修改当前他人正在编辑的 README/main specs。
- 不引入新 dependency。

## 技术方案取舍

### 方案 A：frontend 看到 `R` 后猜测 archive/new path

优点是 backend diff 小；缺点是单个 `path` 已丢失 rename 的另一端，frontend 无法可靠推断 destination，多仓同名路径还会放大歧义。拒绝。

### 方案 B：backend 保留 rename 双路径 identity（采用）

由 libgit2 `head_to_index` / `index_to_workdir` delta 提供 authoritative old/new path；canonical `path` 取 destination，optional `oldPath` 取 source。frontend 只消费明确 contract，并按 `D` 的无 current-file 语义进入只读 preview。该方案修复 shared root cause，且不改变现有 command 形态。

## What Changes

- 扩展 `GitFileStatus` payload，新增 backward-compatible optional `oldPath`。
- 抽取 Desktop/daemon 共用的 status path identity resolver；rename 使用 destination path，deleted 保留 historical path。
- 让 status equality/canonical projection 保留 `oldPath`。
- single/multi Git changed-file activation 对 rename 打开 destination；对 deleted 打开既有 modal diff preview。
- daemon rename mutations 与 Desktop 一样展开 old/new paths，避免 status path 修正后 stage/unstage/discard 只处理 rename 一端。
- Git diff iteration 在 Desktop/daemon 两端统一执行 libgit2 rename detection；stats/full-diff 使用 rename alias pathspec。
- rename mutation resolver 接收 command layer intent：stage/discard 使用 Workdir，unstage 使用 Index。
- single-repository mouse click 与 Enter/Space 复用同一 activation callback。
- 增加 Rust 与 Vitest regression coverage。

## Capabilities

### New Capabilities

- `git-working-tree-change-path-identity`: 定义 rename/deleted working-tree change 的 current/previous path、single/multi repository activation，以及 Desktop/daemon parity。

### Modified Capabilities

- 无。现有 `git-panel-diff-view`、`multi-repository-git-command-center` 与 `editable-workspace-diff-review-surface` contract 保持不变；本 change 补齐其底层 path identity 前置条件。

## Impact

- Backend：`src-tauri/src/git_utils.rs`、Desktop Git status/mutation、daemon Git status/mutation、shared Rust DTO。
- Frontend：shared Git types、status equality/canonical model、single/multi changed-file activation。
- API：`GitFileStatus.oldPath?: string | null` 为 additive field，无 breaking change。
- Dependencies：无新增。

## 验收标准

- staged 与 unstaged rename status 均返回 destination `path` 和 source `oldPath`。
- single-repository 与 nested multi-repository 点击/Enter rename row 时，editor target 分别为 destination 与 `repositoryRoot/destination`。
- deleted row 不调用 ordinary file open，而是打开既有 read-only diff modal；loading/error 均可收敛。
- Desktop 与 daemon status/mutation contract 一致。
- unchanged/modified rename 只产生一个 canonical `R` diff row，且 stats/full-diff 不退化为整文件 add/delete。
- staged `a → b` 且 unstaged `b → c` 时，stage/discard 只解析 Workdir pair，unstage 只解析 Index pair。
- single-repository mouse click 与 Enter/Space 对 `R/D` 的 target 和 preview 行为一致。
- `M/A/U` 及非-Git entrypoint 行为不变。
- focused Rust/Vitest、TypeScript typecheck 与 runtime contract gate 通过。
