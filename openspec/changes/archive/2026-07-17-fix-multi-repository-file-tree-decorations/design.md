## Context

`list_git_repository_summaries` 已通过一次 bounded discovery 返回 root 与 nested repository summaries。`git_repository_summary` 在 Rust 中遍历 `git2::Statuses` 计算 staged/modified/untracked/conflicted counts，但随后丢弃 path-level information。frontend `FileTreePanel` 的 `gitStatusMap` 与 `folderGitStatusMap` 仍只由 active configured Git root 的 `gitStatus.files` 构建，因此 sibling repositories 的 changed files 与 ancestor folders 无法并行 decoration。

现有约束包括：desktop/remote daemon payload parity、workspace-relative POSIX path identity、single aggregate IPC、单 repository partial failure、AppShell render/polling baseline、无新增 dependency，以及 file/folder icon 必须继续由既有 `getFileTreeIconSvg` 决定。

## Goals / Non-Goals

**Goals:**

- 在现有 repository summary scan 中产出 compact `path + status` entries。
- frontend 将每个 repository-relative path 安全投影为 workspace-relative path，并生成全 workspace file/folder status maps。
- exact repository folder 与普通 changed folder 使用同一 folder-name status semantics，但 repository trailing summary 继续表达 branch/count identity。
- Git summary token 使用 semantic theme variables，而不是统一 `accent-primary`。
- payload 缺少新字段时保持 backward compatibility。

**Non-Goals:**

- 不提供 staged/unstaged 双列表、diff stats 或 content。
- 不改变现有 active-root Git Diff/Commit scope。
- 不增加 repository-specific timers、watchers 或 commands。
- 不改变 file tree selection、drag/drop、context menu 与 lazy loading behavior。

## Decisions

### 在 `GitRepositorySummary` 中加入 compact `fileStatuses`

新增 additive field：

```text
GitRepositoryFileStatus {
  path: string   // repository-relative POSIX path
  status: "A" | "M" | "D" | "R" | "T" | "U"
}

GitRepositorySummary.fileStatuses: GitRepositoryFileStatus[]
```

`git_repository_summary` 已持有 status entry；同一次 iteration 中选择 workdir status，否则选择 index status，并为 conflict 输出 `U`。不返回 additions/deletions，也不重复读取 repository。unavailable repository 返回空 array 与 row-local error。

替代方案是新增 aggregate decorations command，但会重复 discovery/open/status scan 或要求新 cache，增加 contract surface；拒绝。

### frontend 在 normalization boundary 校验并 canonicalize entries

normalizer 仅接受 non-empty relative paths，统一 `\\` 为 `/`，移除 `./` 与重复 separator，并拒绝 absolute、drive/prefix、`.`、`..` components。status 只接受已知 code。旧 daemon 缺少 `fileStatuses` 时归一化为空数组。

替代方案是直接信任 serde payload；这会把 remote daemon/path drift 带进 file tree map，拒绝。

### 以 repository root 前缀合并 workspace decoration

frontend helper 将 `repositoryRoot="services/api"` + `path="src/a.ts"` 映射为 `services/api/src/a.ts`；root repository 使用原 path。多个 entry 命中相同 path 时沿用 existing priority，conflict/deleted 优先于 added/modified/renamed/typechange。active-root `gitStatus.files` 作为 compatibility overlay 合并，保证旧 backend 或当前完整 Git status 仍可显示。

### 恢复 icon，颜色只表达文本状态

删除 `.file-tree-row.is-git-repository .file-tree-icon` 与 pseudo-element marker。folder icon 始终保持原 SVG/颜色。changed folder 只对 `.file-tree-name` 应用 status color；repository identity 由 trailing summary 与 context menu 保留。

trailing summary 改为 typed semantic token：branch 使用 theme-aware accent/text mix，clean 使用 `--status-success`，dirty 使用 `--status-warning`，conflict/error 使用 `--status-error`，sync 使用 muted accent。所有颜色通过 CSS variables/`color-mix` 适配 light、dark、system/custom theme。

### IDEA-inspired Git palette 使用集中式 theme tokens

`themes.dark.css`、`themes.light.css` 与 `themes.system.css` 定义同名 `--git-status-added`、`--git-status-modified`、`--git-status-deleted`、`--git-status-renamed`、`--git-status-type-changed`、`--git-status-conflict`、`--git-branch` tokens。dark palette 为 `#73D0A9 / #FFAA3E / #F07178 / #82AAFF / #C792EA / #FF5370 / #FFB37A`；light palette 为 `#2E9D69 / #D97706 / #C2414B / #2563EB / #7C3FA3 / #D32F4B / #C96B2C`。

file tree 与 Composer 只消费这些 shared tokens，不复制 theme selector。branch 独立使用暖橙 token；clean 复用 added green；dirty count 使用 modified orange；conflict/error 使用 conflict red；sync 保持 muted foreground。changed `.file-tree-name` 使用 `font-weight: 550`，而未变更 row 保持 `400`，folder/file icon 不继承该字重。

### Exact repository root 使用统一 dirty blue

repository root 表达的是 repository identity + dirty/clean aggregate state，不表达具体 file mutation type。新增 `--git-repository-dirty`：dark `#82AAFF`、light/system-light `#2563EB`。CSS 仅用 `.file-tree-row.is-git-repository` 覆盖 exact repository name 的 `git-a/git-m/git-d/git-r/git-t/git-u` color；内部 ordinary folder/file 仍使用原 `--git-status-*` palette。clean repository 没有 Git status class，继续使用 normal text color。

branch token 继续使用 `--git-branch` 暖橙色，并在 file tree 与 Composer 两个 consumer 中统一 `font-weight: 600`；sync/count token 不随之加粗。

## Error / Validation Matrix

| 状态 | Backend | Frontend |
|---|---|---|
| valid root repository path | 返回 repository-relative entry | 直接投影为 workspace path |
| valid nested repository path | 返回 nested-relative entry | 加 `repositoryRoot` 前缀 |
| conflict | status `U` | error semantic color，ancestor folder 同步着色 |
| malformed/absolute/traversal entry | 正常实现不产生 | normalizer 丢弃，不污染 map |
| unavailable repository | `error` + empty `fileStatuses` | 仅该 row 显示 unavailable |
| old daemon omits field | serde/default 或 absent JSON | normalize 为 `[]` |
| stale workspace response | 正常返回 | 现有 request sequence 拒绝 stale result |

## Risks / Trade-offs

- [大型 workspace payload 增加] → 仅传 `path + status`，复用同一次 status iteration，不传 diff/stat；保留现有 bounded repository count。
- [summary equality comparison成本增加] → 以 entry array 长度/字段进行确定性比较；只有 aggregate refresh 执行，fallback 不高于 30s。
- [nested path projection重复前缀] → backend contract 固定 repository-relative path，frontend helper 用 focused tests 覆盖 root/nested/Windows separator。
- [custom theme contrast] → Git palette 集中在 theme token 层；custom theme 未覆写时继承 dark baseline，light/system-light 使用明确的高对比 palette。

## Migration Plan

1. additive Rust/TypeScript types 与 normalization tests。
2. 在已有 status scan 收集 compact entries，验证 desktop/daemon serialization。
3. file tree 合并 aggregate decorations，恢复 icon 并应用 semantic token styles。
4. 运行 focused/full gates 与 strict OpenSpec validation。

Rollback 可移除 `fileStatuses` 消费与 UI styles；additive backend field 即使保留也不会改变旧 caller。无持久化数据 migration。

## Open Questions

- 无阻塞问题。若未来 measured payload evidence 显示 path array 过大，应单独设计 pagination/truncation contract，而不是在本次静默截断造成 decoration 不完整。
