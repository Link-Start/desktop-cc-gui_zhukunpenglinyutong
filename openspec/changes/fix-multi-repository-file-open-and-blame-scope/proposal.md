## Why

多 repository workspace 中，Git changed-file row 与 file view Git Blame 都只携带了 repository-relative `path`，却在进入共享 file-open / blame flow 前丢失 `repositoryRoot`。这会让同一功能在单仓可用、在多仓不可点击或错误禁用，并使相同文件名的 repository 存在串仓风险。

## 目标与边界

- 多仓 changed-file row 单击 MUST 打开该 row 所属 repository 的 workspace file，而不是依赖当前全局 `gitRoot` 猜测。
- 多仓 file view Git Blame MUST 通过最长 repository prefix 解析 owner，并向 backend 发送正确的 `repositoryRoot + repository-relative path`。
- 单仓、workspace-root repository、nested repository 与相同 relative path 场景保持确定行为。
- 审计同一 repository identity contract 的相邻入口：modal preview、stage/unstage、commit selection、file tree decoration、file history；已正确携带 scope 的入口保持不变，缺失项纳入本 change。

## 非目标

- 不新增 Rust/Tauri Git command，不改变 Git status polling 或 repository scan。
- 不重做 Git Diff panel、file tree、file editor 或 preview modal UI。
- 不把所有 workspace file navigation 都改成 repository-aware；只有 Git-domain caller 显式携带 repository scope。
- 不顺带修复与 repository path identity 无关的交互或视觉问题。

## What Changes

- 扩展 Git-domain file-open options，使 caller 可显式传递 `repositoryRoot`，并在共享 editor open boundary 一次性投影成 workspace-relative path。
- 接通 multi-repository changed-file row 的 direct click，贯穿 `GitMultiRepositoryChanges -> GitDiffPanel -> useLayoutNodes -> useGitPanelController` repository identity。
- 将 aggregate `gitRepositories` 传入 `FileViewPanel`，复用现有 `resolveFileGitScope` longest-prefix helper 解析 blame scope；repository inventory 已知但无 owner 时保持禁用，禁止 fallback 到错误 repository。
- 增加 single/multi、workspace-root/nested、same-relative-path、longest-prefix 与 non-owner regression tests。
- 增加 repository-aware entrypoint audit matrix，确认 preview、mutation、commit、tree decoration 与 file history 不存在相同 scope 丢失。

## 方案比较与取舍

1. **推荐：显式传递 `repositoryRoot + path`，在共享 editor boundary 投影。** identity 不会在 component adapter 间丢失；单仓 caller 继续省略 override，改动兼容且最小。
2. **备选：row click 前先拼成 workspace-relative path。** 表面少改一层 type，但 shared flow 仍按 `pathDomain: "git"` 再次 prefix，active `gitRoot` 与 row repository 不同时会 double-prefix 或串仓，因此拒绝。
3. **不采用：点击 row 时先切换全局 active `gitRoot`。** 会引入持久化设置副作用、额外 status refresh 与 race，并把“打开文件”错误耦合成“切换 repository”。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `git-panel-diff-view`: multi-repository changed-file direct open 必须保留 repository identity，并正确投影到 workspace file path。
- `file-view-git-blame`: aggregate multi-repository workspace 中必须按文件 owner 解析 blame scope，而不是只依赖 configured `gitRoot`。

## 验收标准

- 多仓 changed-file row 单击可打开文件；两个 repository 都有 `pom.xml` 时分别打开 `repo-a/pom.xml` 与 `repo-b/pom.xml`。
- 多仓中非当前 configured `gitRoot` 的文件仍可启用 Git Blame，request 使用该文件 owner 的 `repositoryRoot` 与 repo-relative `path`。
- nested repository 使用 longest-prefix owner；repository inventory 已知但文件无 owner 时 Blame 不误发到其他 repository。
- 单仓 nested root 与 workspace-root repository 的 file open / Blame 行为不变。
- 相邻 repository-aware 入口审计有自动化证据：modal preview、stage/unstage、commit selection、file tree decoration、file history 均保留 `repositoryRoot`，不存在新的 noop row handler。
- focused Vitest、`npm run typecheck`、`npm run lint`、`git diff --check` 与 strict OpenSpec validation 通过。

## Impact

- Frontend contracts: `OpenFileOptions`、`GitDiffPanel` / `GitMultiRepositoryChanges` callback、`FileViewPanel` props。
- Path projection: `useLayoutNodes` 与 `useGitPanelController`。
- Reuse: `src/features/files/utils/fileGitScope.ts`，不新增 helper 或 dependency。
- Backend/API: 无 command 或 payload breaking change；Blame 继续复用现有 optional `repositoryRoot`。
