## Context

单仓与多仓 changed-file list 已共享 `DiffSection` / `DiffFileRow`。单仓通过 `GitDiffPanel.handleOpenFilePreview` 打开统一 modal，并从当前 `diffEntries` 读取 patch；多仓 adapter 却传入空 `onFileClick` 且没有 `onOpenFilePreview`，因此显式 modal action 没有业务 callback。现有 Tauri service 的 `getGitDiffs` 与 `getGitFileFullDiff` 已支持 optional `repositoryRoot`，backend contract 无需改变。

多仓 status 中的 `path` 是 repository-relative；同一 workspace 内不同 repository 可以拥有相同相对路径。因此 preview identity 不能继续只有 `path`，必须至少包含 `repositoryRoot + path + section`。

## Goals / Non-Goals

**Goals:**

- 在现有统一 modal host 内打开多仓 changed-file preview。
- diff patch、full-context diff、workspace edit target 与 refresh 都保持 repository scope。
- 异步读取使用 request generation，旧 repository response 不得覆盖最新点击。
- repository header 使用单仓 file-row design tokens，文件 row 不引入多仓专用放大样式。

**Non-Goals:**

- 不预加载全部 repository diffs。
- 不改变 stage/unstage/commit API 或 status hook。
- 不创建新的 modal、renderer 或 style token system。

## Decisions

### 1. Preview source state carries repository identity

`GitMultiRepositoryChanges` 新增 typed `onOpenFilePreview(repositoryRoot, file, section)` adapter。`GitDiffPanel` 的 preview state 扩展为 optional repository scope，并持有本次按需读取到的 diff entry。单仓继续从现有 `diffEntries` 派生，保持旧路径无额外 IPC。

选择该方案而不是让多仓 status hook 预取 diffs，因为 preview 是低频显式动作；按点击读取减少初始负载，也避免 status refresh 把 image/base64 diff 长期复制到所有 repository model。

### 2. Latest request wins

多仓 preview handler 递增 request id，调用 `getGitDiffs(workspaceId, repositoryRoot)` 后仅允许最新 request 写入 state。modal 在 scoped diff 成功定位后打开；失败沿用既有 unavailable behavior，并避免错误 repository 内容闪现。

选择 generation guard 而不是 AbortController，因为 Tauri invoke 当前没有 cancellable contract；generation guard 是本地最小且确定的 stale-response 防线。

### 3. Full-context and edit path use the same scope

modal 的 `fullDiffLoader` 显式调用 `getGitFileFullDiff(workspaceId, path, repositoryRoot)`。该 loader 必须继续透传到 `WorkspaceEditableDiffCompare` 的 baseline reconstruction，禁止 editable compare 绕过 parent scope 再调用 legacy configured-root fallback。`workspaceRelativeFilePath` 使用 repository root 而不是当前单仓 `gitRoot` 解析，确保 nested repository 的 editable current column 指向真实文件。

左侧 single-repository UI 继续复用现有 `diffEntries`，但当当前 `gitRoot` 已显式选择时，full-context loader 使用该 `gitRoot`。这样不增加 patch IPC，同时让 patch、full diff 与 workspace edit path 使用相同 repository。

### 4. Preview lifetime follows workspace and repository context

`GitDiffPanel` 在 `workspaceId`、single/multi mode 或 single-mode `gitRoot` 变化时递增 request generation 并清理 preview state。旧 Tauri invoke 不可取消，但其 response 不得在新 context 写回；旧 workspace 的 editable modal 也不得继续挂载到新 `workspacePath`。

### 5. Density reuses single-repository tokens

repository header 的 `min-height`、horizontal padding、gap、font size 与 radius 引用 `--git-filetree-*` tokens；content group gap 从独立放大值收敛为紧凑间距。共享 `DiffSection` / `DiffFileRow` 不改尺寸，避免单仓回归。

## Risks / Trade-offs

- [Risk] 首次点击需要一次 repository-scoped diff IPC → 仅在显式 preview 时付费，并保持 modal source 正确优先于预取速度。
- [Risk] 多仓 preview 保存后只刷新 status，diff patch 可能短暂陈旧 → refresh callback 同时复用 repository status 与现有 Git diff refresh 能力；后续若需要缓存再单独设计。
- [Risk] 相同路径可能从 staged/unstaged 同时出现 → preview identity 保留 section；patch lookup 仍按规范化 path，与现有 diff viewer path-scoped contract一致。
- [Risk] CSS 紧凑化影响窄屏 truncation → header 保留 `minmax(0, 1fr)`、ellipsis 与不可压缩 metadata。
- [Risk] context 切换会丢弃未保存的 modal draft → repository/workspace 已改变时旧 edit target 不再安全，显式 discard 比把旧 draft 写入新 workspace 更可靠。

## Migration Plan

1. 接通 typed callback 与 scoped diff loading。
2. 将 modal path/full-diff/refresh 绑定到 preview repository scope。
3. 应用 token-based compact CSS。
4. 通过 focused tests、typecheck、lint 与 strict OpenSpec validation 后交付。

回滚时可整体移除 scoped callback/state 与多仓 CSS override；现有 backend/service contract 不受影响。

## Open Questions

无。现有 optional `repositoryRoot` command contract 足以完成修复。
