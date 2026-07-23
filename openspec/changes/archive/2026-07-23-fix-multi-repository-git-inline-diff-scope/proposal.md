## Why

当前 multi-repository Git changes 已按 `repositoryRoot` 展示、stage、unstage 和单文件 discard，但 center-area inline diff 的 selection contract 仍只传 `path`。当不同 repository 存在相同 relative path，或用户从 nested repository 点击 inline preview 时，`useGitPanelController` 会继续读取 workspace-root `gitDiffs`，导致 center diff 无法命中、展示错误 repository 内容或停留在旧 selection。

同一视图还有两个一致性缺口：unstaged section header 已有共享 discard-all affordance，但 multi-repository group 没有传递 repository-scoped batch callback；进入 center diff mode 后底部 Composer 仍占据内容高度。Composer branch repository root view 的 Update All / Checkout All 则以大号文字行插在 repository list 前，和 single-repository header actions 的位置、密度不一致。

本 proposal 以当前工作区 11 个代码变更为事实源，补齐对应 behavior contract，不扩大到新的 Git backend 能力。

## 目标与边界

- multi-repository file inline preview 必须携带 `repositoryRoot + path`，并加载该 repository 的 local diffs。
- center diff 的 loading、error、selection 与 stale request settlement 必须来自当前 repository scope。
- multi-repository unstaged section 支持 discard-all，确认后只逐个 revert 当前 repository 的 paths，并沿用现有 confirmation dialog。
- center `diff` mode 独占内容区，不在底部重复渲染 Composer。
- multi-repository branch root actions 移到 command header，使用 compact icon-only、tooltip/ARIA 可访问按钮；mutation semantics 不变。

## 非目标

- 不新增或修改 Rust/Tauri command；继续复用 `getGitDiffs(workspaceId, repositoryRoot)` 和现有 repository-scoped revert。
- 不改变 modal file preview、direct file open、stage/unstage/commit/push 或 Git History behavior。
- 不改变 Update All / Checkout All 的串行执行、partial failure、branch coverage 或 refresh semantics。
- 不重构整个 Git panel/controller，不新增全局 store，不引入 dependency。
- 不为 staged section 提供 discard-all；discard 仍仅适用于 unstaged changes。

## What Changes

- 扩展 `onSelectFile` / `handleSelectDiff` prop chain，使 nested repository inline preview 传递 optional `repositoryRoot`。
- `useGitPanelController` 在 local diff + explicit repository scope 下调用 `getGitDiffs`，使用现有 `buildCanonicalGitChanges` 生成 viewer model，并隔离 loading/error/stale completion。
- workspace 切换、selection 清空或非 repository-scoped selection 时清理 repository scope，回退现有 workspace-root diff path。
- `GitMultiRepositoryChanges` 将 inline preview 与 section discard-all 回调绑定当前 group 的 exact `repositoryRoot`。
- `GitDiffPanel` 复用现有 `explicit-repository` confirmation target 执行多 path discard；完成后统一 refresh aggregate statuses。
- `DesktopLayout` 在 `centerMode === "diff"` 时隐藏 bottom Composer。
- `ComposerBranchBadge` 将 multi-repository root actions 移入 search header，显示 compact icon buttons，保留 accessible labels、pending disable 与原 handler。

## 技术方案对比

### Option A：selection 同时携带 `repositoryRoot + path`，按需加载 scoped diffs（采用）

- 复用已存在的 `getGitDiffs(workspaceId, repositoryRoot)` 和 canonical viewer mapper。
- 优点：identity 完整；无需改 backend；single-repository 和 commit/PR diff path 不变；改动集中在现有 prop chain。
- 代价：controller 增加一份短生命周期 scoped loading/error state。

### Option B：把所有 repository diffs 预加载并合并到 workspace-root list

- 进入 multi-repository panel时并发获取全部仓库 diff，再使用 composite key。
- 优点：切换文件时可能更快。
- 缺点：增加启动 I/O、内存与 stale-response 协调；还需重写 selection identity，不符合本次按需 preview 范围。

### Option C：inline preview 直接改成 modal preview

- 复用已经 repository-scoped 的 modal content loader，绕开 center diff。
- 优点：代码更少。
- 缺点：改变用户点击 inline action 的语义，不能修复 center diff identity，也无法满足现有 inline affordance，因此不采用。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `multi-repository-git-commit-workspace`: 增加 repository-scoped center inline diff、unstaged section discard-all 与 diff-mode layout contract。
- `multi-repository-git-command-center`: 将 workspace-scoped branch actions 收敛为 command header compact actions，同时保持现有 execution semantics。

## Impact

- Git orchestration：`src/features/app/hooks/useGitPanelController.ts`、`src/app-shell-parts/useAppShellSections.ts`。
- Git UI：`GitDiffPanel.tsx`、`GitDiffPanelTypes.ts`、`GitMultiRepositoryChanges.tsx` 及 focused tests。
- Layout：`DesktopLayout.tsx`、`layoutNodesTypes.ts`。
- Composer branch UI：`ComposerBranchBadge.tsx`、test 与 `composer.part2.css`。
- Backend/API/dependencies：无变更。

## 验收标准

- 从 nested repository 的 unstaged/staged file 点击 inline preview 后，center diff 使用 exact `workspaceId + repositoryRoot` 加载，并选中该 relative path。
- 两个 repository 同时存在 `pom.xml` 时，选择其中一个只显示其 owning repository diff；不会复用另一个 repository 或 workspace-root diff。
- scoped request loading/error 显示在 center diff；workspace/selection 切换后迟到结果不得覆盖当前 diff。
- 未提供 `repositoryRoot` 的 single-repository、commit 和 PR diff selection 保持现有数据源。
- multi-repository unstaged section header 仅出现一个 discard-all action；确认后仅对该 group 的 paths 调用 exact `repositoryRoot` revert，取消时不 mutation，完成后 refresh。
- center diff mode 不显示 bottom Composer；离开 diff mode 后原 layout behavior 恢复。
- branch repository root view 的 Update All / Checkout All 位于 command header，以 icon-only button 呈现，有 tooltip/accessible name；pending dedupe、执行结果与 repository rows 不变。
- focused Vitest、`npm run typecheck`、targeted lint、`git diff --check` 与 strict OpenSpec validation 通过。
