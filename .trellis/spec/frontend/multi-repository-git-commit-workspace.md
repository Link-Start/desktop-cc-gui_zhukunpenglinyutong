# Multi-Repository Git Commit Workspace Contract

## Scope

适用于 `src/features/git/**`、`src/features/app/hooks/useGitCommitController.ts`、`src/services/tauri/git.ts` 与 `src-tauri/src/git/**` 的多 repository status、selection、stage、commit、push 和 branch update 链路。

## Identity Contract

- Git operation identity MUST 使用 `workspaceId + repositoryRoot`。
- `repositoryRoot === undefined/null`：legacy configured Git root fallback。
- `repositoryRoot === ""`：workspace root repository。
- non-empty `repositoryRoot`：normalized workspace-relative discovered child repository。
- explicit invalid/unknown/escaping repository root MUST return error，禁止 fallback 到 configured root。

## Signatures

```ts
getGitStatus(workspaceId, repositoryRoot?)
stageGitFile(workspaceId, path, repositoryRoot?)
stageGitAll(workspaceId, repositoryRoot?)
unstageGitFile(workspaceId, path, repositoryRoot?)
commitGit(workspaceId, message, repositoryRoot?)
pushGit(workspaceId, options?, repositoryRoot?)
pullGit(workspaceId, options?, repositoryRoot?)
syncGit(workspaceId, repositoryRoot?)
fetchGit(workspaceId, remote?, repositoryRoot?)
getGitDiffs(workspaceId, repositoryRoot?)
getGitFileFullDiff(workspaceId, path, repositoryRoot?)
getGitCommitHistory(workspaceId, { ..., repositoryRoot? })
getGitCommitDetails(workspaceId, commitHash, maxDiffLines?, repositoryRoot?)
getGitCommitDiff(workspaceId, sha, { path?, contextLines?, repositoryRoot? })
getGitPushPreview(workspaceId, { remote, branch, limit?, repositoryRoot? })
```

Rust Tauri/daemon 对应 command 参数使用 `repository_root: Option<String>`，remote forwarding payload 使用 camelCase `repositoryRoot`。

## Adaptive UI Contract

| Repository topology | Render shape | Status source |
|---|---|---|
| 0/1 repository | existing compact `GitDiffPanel`，无额外 repository header，changed-file header 保留 manual refresh | existing `useGitStatus` |
| 2+ repositories | dirty repositories 分组，header 显示 name/branch/count/manual refresh | `useMultiRepositoryGitStatus` scoped parallel reads |

- clean repository 不创建空 group。
- 同名 repository-relative path 必须按 `repositoryRoot` 隔离 selection 与 mutation。
- repository header selection 是 tri-state；file selection 保留 existing staged-default semantics。
- multi repository status partial failure 只影响对应 group。
- workspace 切换后 stale response MUST 被 request id 拒绝。
- single / multi render path MUST 保持 manual status refresh action parity；multi repository 每个 group header 的入口 MUST 复用 aggregate `onRefresh()`，禁止新增平行 Git status command。
- aggregate refresh in flight 时，multi repository header refresh buttons MUST disabled，并统一反映 `isLoading`；不得为每个 header 复制独立 timer 或请求状态。
- single 与 multi diff mode MUST 使用同一 vertical composition：changed-file content 是独立 scroll region，commit composer 位于 DOM 尾部并固定在 panel bottom。
- 禁止让 textarea/commit button 跟随长文件列表滚出视口，也禁止 footer 覆盖最后一行文件。

## Scenario: Multi-Repository Unstaged File Discard

### 1. Scope / Trigger

- Trigger：修改 `GitMultiRepositoryChanges`、multi-repository file mutation callback 或 discard confirmation flow。
- 目标：unstaged row 复用 single-repository discard affordance，同时通过 explicit repository identity 防止同名 path 串仓。

### 2. Signatures

```ts
onRevertRepositoryFile(repositoryRoot: string, path: string): Promise<void>
revertGitFile(workspaceId: string, path: string, repositoryRoot?: string | null): Promise<void>
```

### 3. Contracts

- `DiffFileRow` MUST 只在 `section === "unstaged"` 且存在 `onDiscardFile` 时显示 shared `Undo2` action；staged row 禁止显示。
- Multi-repository callback MUST 从 row owner 传递 explicit `repositoryRoot + path`，禁止读取 global selected repository 推断 scope。
- `GitDiffPanel` MUST 复用现有 destructive confirmation dialog，并用 discriminated target 区分 current-repository 与 explicit-repository mutation。
- Cancel MUST 不执行 mutation；confirm MUST 在成功 revert 后刷新一次 multi-repository statuses。
- `repositoryRoot === ""` 是有效 workspace-root identity，MUST 原样传递。

### 4. Validation & Error Matrix

| 场景 | 必须行为 | 禁止行为 |
|---|---|---|
| unstaged row 有 scoped handler | 显示 discard action | 因 multi mode 隐藏 icon |
| staged row | 不显示 discard action | 对 index state 执行 worktree discard |
| dialog cancel | callback 0 次 | 提前 mutation |
| A/B 都有 `pom.xml`，点击 B | 调用 `("B", "pom.xml")` | fallback 到 A/global scope |
| explicit root `""` | 保留空字符串 | truthy fallback 到 configured root |
| revert 成功 | mutation 完成后 refresh 一次 | 每层重复 refresh |
| revert 失败 | error 向 caller 传播，不伪造成功 refresh | 吞异常并关闭为成功状态 |

### 5. Good / Base / Bad Cases

- Good：`onDiscardFile("services/api", "pom.xml")` → confirmation → `revertGitFile(workspaceId, "pom.xml", "services/api")` → refresh。
- Base：single-repository 继续调用 `onRevertFile(path)`，不要求 repository callback。
- Bad：在 `GitMultiRepositoryChanges` 内直接调用 service、自建 dialog，或依赖 selected repository 补 root。

### 6. Tests Required

- `GitMultiRepositoryChanges.test.tsx`：unstaged action 可见、staged 不可见，并断言 callback 收到 row owner 的 `repositoryRoot + path`。
- `GitDiffPanel.test.tsx`：cancel no-op；confirm 执行 scoped revert 后 refresh。
- `GitDiffPanel.test.tsx`：A/B 同名 relative path 点击 B 时只调用 B scope。
- `npm run typecheck` 与 `check:app-shell:runtime-contract`：验证 AppShell → layout → Git panel callback chain。

### 7. Wrong vs Correct

#### Wrong

```tsx
<DiffSection onDiscardFile={(path) => onRevertFile(path)} />
```

#### Correct

```tsx
<DiffSection
  onDiscardFile={(path) => onDiscardFile(status.repositoryRoot, path)}
/>
```

## Scenario: Unified Git Diff File Context Menu

### 1. Scope / Trigger

- Trigger：修改 `GitDiffPanel`、`GitMultiRepositoryChanges`、`DiffSection` 的 changed-file context menu、file mutation action 或 flat/tree renderer。
- 目标：single-repository flat/tree 与 multi-repository grouped rows MUST 提供一致的 `Git` file action submenu，同时由 parent 保留唯一 menu ownership 和 repository identity。
- 本 scenario 覆盖 file-scoped Stage / Unstage / Discard 与 read-only File History；Blame 与 repository-scoped commands 不属于该菜单。

### 2. Signatures

```ts
type GitDiffFileSection = "staged" | "unstaged";

type RepositoryFileMenuHandler = (
  event: ReactMouseEvent<HTMLDivElement>,
  repositoryRoot: string,
  path: string,
  section: GitDiffFileSection,
) => void;

type GitMultiRepositoryChangesProps = {
  onShowFileMenu?: RepositoryFileMenuHandler;
};

type GitDiffPanelProps = {
  onOpenFileHistory?: (target: FileHistoryTarget) => void;
};

resolveGitDiffFileHistoryTarget({
  workspaceId,
  workspacePath,
  path,
  gitRoot?,
  repositoryRoot?,
}): FileHistoryTarget | null

showFileMenu(
  event: ReactMouseEvent<HTMLDivElement>,
  path: string,
  section: GitDiffFileSection,
): void

showRepositoryFileMenu(
  event: ReactMouseEvent<HTMLDivElement>,
  repositoryRoot: string,
  path: string,
  section: GitDiffFileSection,
): void

onStageRepositoryFile(repositoryRoot: string, path: string): Promise<void>
onUnstageRepositoryFile(repositoryRoot: string, path: string): Promise<void>
onRevertRepositoryFile(repositoryRoot: string, path: string): Promise<void>
```

- `GitDiffPanel` MUST own the single `RendererContextMenuState` and render the single `RendererContextMenu` portal。
- `GitMultiRepositoryChanges` / `DiffSection` MUST only forward typed row intent；禁止 child 自建 menu state、portal、confirmation dialog 或直接调用 service。

### 3. Contracts

- Every file-row `contextmenu` handler MUST synchronously call `preventDefault()` and `stopPropagation()` before checking actions；即使 `mutationDisabled` 或 handler 缺失，也禁止退回 browser / WebView native menu。
- Custom menu root MUST expose one `Git` submenu；Stage / Unstage / File History / Discard MUST 位于该 submenu，禁止在 root level 散落。
- Action availability MUST derive from the clicked row section, not inferred global state：
  - `section === "staged"`：只允许 Unstage。
  - `section === "unstaged"`：允许 Stage 和 destructive Discard。
- Discard MUST NOT appear for staged files。`显示文件历史` MAY appear when `onOpenFileHistory` 与 exact target 可用；Blame、Commit、Push、Pull、Fetch、Sync、Checkout、branch operations 与 Stage All MUST NOT appear in this file menu。
- History MUST capture the clicked row only；single bulk selection MUST continue to affect mutation actions but MUST NOT replace the History target。
- History target MUST use `workspaceId + workspacePath + repositoryRoot + repository-relative path`；`displayPath` MUST be workspace-relative。single root 的 null/empty/workspace-equal Git root 归一化为 explicit `repositoryRoot=""`。
- Single repository batch behavior MAY reuse current selection，但 MUST intersect targets with the clicked section；staged menu 不得因 selection 中混有 unstaged path 而出现 Stage / Discard。
- Multi repository menu MUST target only the clicked row and MUST forward explicit `repositoryRoot + path + section`；禁止使用 global selected repository 或 flatten all repositories 的 selected paths。
- `repositoryRoot === ""` MUST 原样穿过 menu intent 和 mutation callback；只有 `undefined` 才表示 legacy configured-root fallback。
- Same relative path in repository A/B MUST remain isolated by `repositoryRoot`；right-click B 的 `pom.xml` 只能 mutate B。
- `mutationDisabled` file MUST expose no mutation item，但 exact File History target 有效时 MUST 仍允许 read-only History；所有 action 均缺失时才关闭/不显示 custom menu，同时继续 suppress native menu。
- Open file menu MUST be invalidated when workspace/path、Git root、repository/file topology、loading state、History callback 或 scoped mutation callback identity changes；stale action MUST NOT remain activatable。
- Discard MUST reuse parent-owned destructive confirmation flow。Cancel MUST execute zero mutations and zero refresh；confirm MUST execute the scoped revert once, then refresh status exactly once after success。
- Stage / Unstage MUST execute the scoped mutation once and refresh status exactly once after success；menu builder/renderer 禁止叠加第二次 refresh。
- Menu adapter MUST NOT convert mutation rejection into success；禁止执行 success refresh、伪造 success 或 silently retry another repository。本 change 不新增独立 mutation error UI。
- Context-menu open/close MUST NOT mutate commit selection、open a file、toggle folder/section collapse or trigger repository polling。

### 4. Action Matrix

| Topology / renderer | Row state | `Git` submenu | Target scope |
|---|---|---|---|
| single + flat | staged, mutable + History | Unstage + History | mutation=clicked section selection；History=clicked row |
| single + tree | staged, mutable + History | Unstage + History | mutation=clicked section selection；History=clicked row |
| single + flat/tree | unstaged, mutable + History | Stage + History + Discard | mutation=clicked section selection；History=clicked row |
| multi + flat | staged, mutable + History | Unstage + History | clicked `repositoryRoot + path` only |
| multi + grouped list | staged, mutable + History | Unstage + History | clicked `repositoryRoot + path` only |
| multi + grouped list | unstaged, mutable + History | Stage + History + Discard | clicked `repositoryRoot + path` only |
| any | `mutationDisabled` + valid History | History only | clicked row only |
| any | no eligible mutation/History handler | no custom submenu/item | no action |

### 5. Validation & Error Matrix

| 场景 | 必须行为 | 禁止行为 |
|---|---|---|
| right-click mutable row | suppress native menu；打开 parent-owned `Git` submenu | browser “Reload / Inspect” menu |
| right-click staged row | only Unstage | Stage 或 Discard |
| right-click unstaged row | Stage + destructive Discard | Unstage |
| single flat/tree 切换 | action set 与 target semantics 不变 | tree path 丢失 menu 或改用另一套 handler |
| A/B 都有 `pom.xml`，right-click B | callback receives `("B", "pom.xml", section)` | mutate A / configured root |
| explicit root `""` | callback 保留 `""` | truthy fallback 到 configured root |
| multi A/B 同名 path History | target 使用 clicked repository 的 exact root/path | History 打开另一 repository |
| single multi-selection History | target 只使用 clicked row | 用 selected paths 构造多文件/错误文件 target |
| `mutationDisabled` + History | native menu suppressed，History 可用，mutation 0 次 | read-only capability 被 mutation flag 误禁 |
| History callback/workspace/scope missing | omit History，保留独立可用 mutation | 显示 dead History item |
| discard cancel | mutation 0 次，refresh 0 次 | 提前 revert |
| discard confirm success | scoped revert 1 次，refresh 1 次 | double mutation / double refresh |
| mutation rejects | callback 保持 rejected semantics，success refresh 0 次 | 伪造 success / fallback to another repository |
| menu open/close | commit inclusion、collapse、file-open、polling count 不变；保留既有 row selection 语义 | contextmenu 冒泡触发 row click |
| menu open 后 topology / workspace 变化 | file menu 立即关闭，旧 callback 不可激活 | 继续 mutate 旧 workspace/repository target |

### 6. Good / Base / Bad Cases

- Good：multi B unstaged `pom.xml` → `onShowFileMenu(event, "B", "pom.xml", "unstaged")` → `Git > Stage / History / Discard`，History target root=`B`。
- Good：workspace-root repository → `onShowFileMenu(event, "", "README.md", "staged")` → scoped Unstage/History with `repositoryRoot=""`。
- Good：single staged selection mixed with an unstaged row → right-click staged row still exposes only Unstage for staged targets。
- Base：single repository continues using existing optional repository fallback；只统一 menu shape，不改变 service signature。
- Bad：`onShowFileMenu={() => {}}`、child `new RendererContextMenuState()`、或让 empty items fall through to native WebView menu。
- Bad：根据 path 在 aggregate status 中反查 repository；A/B 同名 path 会产生 ambiguous target。
- Bad：History 读取 `selectedFiles` 并打开 selection 第一项，或用 truthy fallback 吞掉 root `""`。
- Bad：把 Blame 或 Commit / Push / Pull / Fetch 等 repository command 填进当前 file submenu。

### 7. Tests Required

- `GitDiffPanel.test.tsx`：single flat/tree staged 只显示 Unstage；unstaged 显示 Stage + Discard；root menu 仅有 `Git` submenu。
- `GitDiffPanel.test.tsx`：mixed selection 按 clicked section 取交集；staged path 不得进入 discard confirmation target。
- `GitMultiRepositoryChanges.test.tsx`：staged/unstaged grouped row 均 forward exact `event + repositoryRoot + path + section`，且不再使用 noop handler。
- `GitDiffPanel.test.tsx`：A/B 同名 path 和 explicit root `""` mutation payload 隔离。
- `GitDiffPanel.test.tsx`：workspace/repository topology rerender 后旧 file menu 被关闭，mutation/refresh 均为 0。
- `GitDiffPanel.test.tsx`：`mutationDisabled` 与 missing handler 均调用 `preventDefault()`，不显示 mutation，且不触发 native menu observable path。
- `GitDiffPanel.test.tsx`：single flat/tree multi-selection History 只打开 clicked row；root/nested/Windows target mapping 与 invalid path/root rejection。
- `GitDiffPanel.test.tsx`：multi A/B 同名 path 与 explicit root `""` History target 隔离；`mutationDisabled` row 保留 History-only menu。
- `useLayoutNodes.client-ui-visibility.test.tsx`：existing `onOpenFileHistory` callback 原样透传到 `GitDiffPanel`。
- `GitDiffPanel.test.tsx`：discard cancel 为 mutation/refresh `0/0`；confirm success 为 `1/1`；failure 不执行 success refresh。
- `GitDiffPanel.test.tsx`：menu 不包含 Blame、Commit、Push、Pull、Fetch、Sync、Checkout、Stage All。
- Existing file click、preview、commit selection、collapse 与 refresh/polling tests MUST remain green。

## Git History Independent Repository Selection

- existing workspace/worktree `GitHistoryProjectPicker` MUST 始终保留为第一层，禁止以 repository list 替换。
- `GitHistoryPanel` 在当前 History workspace 的 `repositories.length > 1` 时 MUST 增加第二个 `GitHistoryProjectPicker` 展示 discovered repositories。
- repository option identity MUST encode `repositoryRoot`，包括 workspace-root `""`；不得用 display name 作为 identity。
- AppShell MUST 维护独立 selected History project workspace / `gitHistoryRepositoryRoot`。
- repository selection MUST 只更新 `gitHistoryRepositoryRoot`；MUST NOT 调用 `addWorkspaceFromPath`、修改 workspace catalog 或触发主 `setActiveWorkspaceId`。
- Git History commands MUST 继续使用 selected project `workspaceId`，并通过 optional `repositoryRoot` 复用 backend `resolve_git_root_for_scope`；omitted scope MUST 保持 single-repository legacy behavior。
- `GitHistoryWorktreePanel` 的 status、stage、unstage、revert、commit 与 commit message generation MUST 使用同一个 selected `repositoryRoot`。
- Git History worktree component lifetime MUST 绑定 `workspaceId + repositoryRoot`；切仓时 MUST remount repository-local state，隔离旧仓仍在执行的 mutation、commit message generation 与同路径 selection override。
- repository scope change MUST 立即将 parent worktree summary 清零；新 status 成功后再写入当前仓统计，失败时禁止保留旧仓 changed files/additions/deletions。
- Git History 左侧 worktree root label MUST 跟随 selected repository display name/path leaf，禁止继续显示 configured fallback repository name。
- active main workspace change MUST invalidate stale history selection request，并将 history scope 重置到新 workspace。
- repository summaries MUST 跟随 independent History workspace 一次性刷新并拒绝 stale response；禁止新增 polling，也禁止错误复用主 active workspace 的 summaries。

## Commit Message Generation Contract

- single mode 继续使用 `selectedPaths?: string[]`。
- multi mode 使用 `repositorySelections?: Array<{ repositoryRoot: string; selectedPaths: string[] }>`，每个 scope MUST 经 `resolve_git_root_for_scope` 校验后收集 diff。
- multi repository composer MUST 显示与 single mode 相同的 `CommitMessageEngineIcon`、engine/language menu、loading/error state。
- multiple scoped diffs MUST 合并为一次 prompt 与一次 generated message；禁止只读取第一个 repository 或 fallback 到 configured root。

## Scenario: Multi-Repository Changed-File Open And Modal Preview

### 1. Scope / Trigger

- Trigger：修改 `GitMultiRepositoryChanges`、`GitDiffPanel` multi-repository changed-file rows、direct file open、modal preview activation 或 repository-scoped diff loading。
- 目标：共享 file renderer 的 direct open 与 preview action 必须保留 repository identity，防止同名 relative path 串仓或 no-op callback。

### 2. Signatures

```ts
onOpenFile(repositoryRoot: string, path: string): void

onOpenFilePreview(
  repositoryRoot: string,
  file: DiffFile,
  section: "staged" | "unstaged",
): void

getGitDiffs(workspaceId: string, repositoryRoot?: string | null): Promise<GitFileDiff[]>
getGitFileFullDiff(
  workspaceId: string,
  path: string,
  repositoryRoot?: string | null,
): Promise<string>

WorkspaceEditableDiffCompare({
  fullDiffLoader?: ((path: string) => Promise<string>) | null
})
```

### 3. Contracts

- Multi-repository preview identity MUST 使用 `workspaceId + repositoryRoot + normalized filePath + section`；不得只按 `filePath` 建模。
- `GitMultiRepositoryChanges` direct click 与 keyboard selection MUST 将 row 所属 `repositoryRoot + path` 传给 canonical editor open flow；禁止以 `onFileClick={() => {}}` 留下单仓可开、多仓 no-op 的 file row。
- `GitDiffPanel` / layout adapter MUST 保留 optional `repositoryRoot` 到 `OpenFileOptions { pathDomain: "git", repositoryRoot }`，由 shared editor boundary 只做一次 workspace-relative projection；不得提前拼 path 后再重复添加 configured root。
- `repositoryRoot === ""` MUST 作为 explicit workspace-root identity 覆盖 configured nested root；只有 `repositoryRoot === undefined` 才允许 single-repository configured-root fallback。
- `GitMultiRepositoryChanges` MUST 将 row 所属 `repositoryRoot` 传给 canonical `GitDiffPanel` modal host；缺失 `onOpenFilePreview` 时不得伪装成可用 preview action。
- Scoped patch read MUST 调用 `getGitDiffs(workspaceId, repositoryRoot)`；full-context read MUST 调用 `getGitFileFullDiff(workspaceId, path, repositoryRoot)`。
- `GitDiffPanel` MUST own repository scope selection and pass one `fullDiffLoader` through `WorkspaceEditableDiffReviewSurface` into `WorkspaceEditableDiffCompare`; editable baseline reconstruction MUST NOT bypass the parent loader with an unscoped command。
- Left single-repository activation MUST continue using existing `diffEntries` without extra patch IPC；当 configured `gitRoot` 可安全投影为 workspace-relative repository root 时，full-context loader MUST 显式携带该 scope。absolute external configured root MUST 保留 omitted-scope fallback，由 backend configured root 解析。
- `repositoryRoot === ""` MUST 作为 explicit workspace-root scope 传递；不得用 `??`/truthy fallback 吞掉为空字符串的有效 identity。
- Workspace edit target MUST 通过同一 `repositoryRoot` 将 repository-relative `filePath` 转为 workspace-relative path。
- Concurrent preview requests MUST 使用 monotonically increasing request id 或等价 generation guard；只有 latest request 可以写 modal state，close/single-repository activation MUST invalidate in-flight scoped request。
- `workspaceId`、single/multi mode 或 single-mode `gitRoot` 变化 MUST invalidate pending generation 并 teardown 旧 modal；禁止把旧 workspace draft 挂到新 `workspacePath` 后继续编辑。
- Single-repository preview MUST 继续读取现有 `diffEntries`，不得因该 contract 增加额外 scoped IPC。
- Multi-repository repository header MUST 复用 `--git-filetree-row-*` 与 `--git-filetree-name-*` tokens；file/folder row 继续使用共享 renderer，禁止添加 multi-only 放大规则。

### 4. Validation & Error Matrix

| 场景 | 必须行为 | 禁止行为 |
|---|---|---|
| 点击 / Enter child repository file row | 打开 `<repositoryRoot>/<path>` workspace tab | event 被当成 path、callback no-op 或 fallback 到 configured root |
| A/B 都有 `pom.xml` direct open | 分别生成 `A/pom.xml` 与 `B/pom.xml` tab identity | 两行复用同一 `pom.xml` tab |
| 点击 child repository preview | modal 立即进入 loading，并按 child `repositoryRoot` 读取 patch | button 可见但 callback no-op |
| A/B 都有 `pom.xml`，A 较慢返回 | modal 保持最后点击的 B diff | A response 覆盖 B |
| explicit root `repositoryRoot=""` | payload 保留空字符串，定位 workspace-root repo | fallback 到 configured root |
| scoped diff 失败 | latest modal 进入 unavailable state并记录可定位错误 | 展示上一 repository diff 或吞异常 |
| modal close 后旧请求返回 | response 被 request id 拒绝 | 重新打开已关闭 modal |
| single repository preview | 使用既有 `diffEntries` 与 configured `gitRoot` | 新增 `getGitDiffs` round trip |
| left selected nested repository | editable baseline/full diff 使用 normalized repository scope | child compare 再调用无 scope full diff，导致 loading 或错仓 |
| workspace/root/mode 切换 | discard old local draft、关闭 modal、旧 response ignored | modal 保留并把旧文件写入新 workspace |
| configured external absolute Git root | omitted scope 复用 backend configured root | 把 absolute path 当 `repositoryRoot` 发送并被 boundary reject |

### 5. Good / Base / Bad Cases

- Good：`onOpenFilePreview("services/api", file, "unstaged")` → `getGitDiffs(workspaceId, "services/api")` → workspace edit path `services/api/<file.path>`。
- Good：`onOpenFile("services/api", "pom.xml")` → `{ pathDomain: "git", repositoryRoot: "services/api" }` → editor tab `services/api/pom.xml`。
- Good：先点 A 再点 B，A late response 因 request id 过期被忽略。
- Good：左侧 `gitRoot=/workspace/services/api` 被投影为 `services/api`，同一 loader 同时供 viewer 与 editable baseline 使用。
- Base：single repository 仍通过 `handleOpenFilePreview(file, section)` 使用父层 `diffEntries`。
- Bad：多仓 adapter 复用 row JSX，但传 `onFileClick={() => {}}`，或把 `ReactMouseEvent` 误当 repository-relative path。
- Bad：用 `diffEntries.find(entry.path === file.path)` 在所有 repositories 共用同一 patch source。

### 6. Tests Required

- `GitMultiRepositoryChanges.test.tsx`：点击 `.diff-row-action--preview-modal` 断言 callback 收到 `repositoryRoot + file + section`。
- `GitMultiRepositoryChanges.test.tsx`：click 与 Enter file row 均断言 direct-open callback 收到 `repositoryRoot + path`。
- `useGitPanelController.test.tsx`：覆盖 configured fallback、explicit workspace-root `""` 与 A/B 同名 path 生成 distinct tabs。
- `GitDiffPanel.test.tsx`：两个 repositories 具有相同 path，断言两次 `get_git_diffs` payload scope 正确，late first response 不覆盖 second。
- `GitDiffPanel.test.tsx`：断言 modal `workspaceRelativeFilePath` 包含 child root，`fullDiffLoader` payload 包含同一 `repositoryRoot`。
- `WorkspaceEditableDiffReviewSurface.test.tsx`：断言 `fullDiffLoader` 继续传给 editable compare。
- `WorkspaceEditableDiffCompare.test.tsx`：truncated/invalid patch baseline recovery 必须调用 parent loader，且不得调用 legacy service fallback。
- `GitDiffPanel.test.tsx`：覆盖 explicit root `""`、pending close、scoped failure settle、workspace pending switch 与 single-mode `gitRoot` switch。
- `git-commit-composer-layout.test.ts`：repository header 使用 `--git-filetree-row-min-height` / padding tokens，且不存在 multi-only `.diff-row` size override。

### 7. Wrong vs Correct

#### Wrong

```tsx
<DiffSection
  onFileClick={() => {}}
  onShowFileMenu={() => {}}
/>
```

#### Correct

```tsx
<DiffSection
  onFileClick={(_event, path) =>
    onOpenFile?.(status.repositoryRoot, path)
  }
  onSelectFile={(path) => {
    if (path) onOpenFile?.(status.repositoryRoot, path);
  }}
  onOpenFilePreview={(file, section) =>
    onOpenFilePreview?.(status.repositoryRoot, file, section)
  }
  onShowFileMenu={(event, path, section) =>
    onShowFileMenu?.(event, status.repositoryRoot, path, section)
  }
/>
```

#### Wrong: editable child loses repository scope

```tsx
void getGitFileFullDiff(workspaceId, filePath);
```

#### Correct: parent-owned loader remains the single scope source

```tsx
<WorkspaceEditableDiffCompare
  fullDiffLoader={fullDiffLoader}
/>
```

## Mutation Contract

- 多 repository commit MUST 按 root-first + normalized path 顺序执行。
- 每个 repository 产生独立 commit，共用同一 commit message。
- 某 repository commit failure 不阻塞后续 repositories。
- 成功 group 刷新；失败 group 保留 changes/selection 以供 retry。
- commit-and-push 只 push 本轮 committed repositories，push failure 与 commit failure 分开归因。
- Git 不提供跨 repository atomic transaction；禁止伪造全局 rollback 成功语义。

## Error Matrix

| 场景 | 行为 |
|---|---|
| explicit repository update 且未全局 selected | 仍使用 active workspace id + explicit root 执行 |
| one status request fails | 其他 groups 正常显示，失败 group 展示 readable error |
| one commit fails | 继续后续 repository，最终逐 repository 汇总 |
| commit succeeds but push fails | commit 保持成功，push 单独失败 |
| root escapes workspace | backend reject，不执行 Git command |
| History switches from repository A to B | branch/status/history/detail requests use the same selected `repositoryRoot`; stale A responses MUST NOT become visible |
| History mutation or AI generation for A resolves after switching to B | operation stays scoped to A, but its local UI result MUST NOT write into B; B summary/selection/message remain repository-local |

## Good / Base / Bad Cases

- Good：右键 child repository 更新时直接传 `repositoryRoot`；即使 selected repository 为 `null`，仍从 active workspace 取得 `workspaceId`。
- Good：两个 repositories 都有 `pom.xml` 时，selection key 包含 repository root，各自 stage/commit。
- Good：multi commit 中 repository A 失败后继续 B，并只对成功 commit 的 repository 执行 push。
- Base：调用方不传 `repositoryRoot`，继续使用 configured Git root，single repository UI 不增加 group header。
- Bad：先写全局 `selectedRepositoryRoot` 再延迟执行 mutation；快速切换会产生 target race。
- Bad：把多个 repositories 的 relative paths flatten 成一个 `Set<string>`，同名 path 会互相覆盖。
- Bad：把 sequential multi commit 描述成 atomic transaction，或在 partial failure 后清除所有 selection/message。

## Tests Required

- `useAppShellGitWorkspaceOpsSection.test.tsx`：未 selected repository 的 explicit update。
- `useMultiRepositoryGitStatus.test.tsx`：single bypass、parallel multi、partial failure。
- `GitMultiRepositoryChanges.test.tsx`：multi groups、same-relative-path isolation、每仓 header manual refresh parity、aggregate callback 与 loading duplicate guard。
- `multiRepositoryCommit.test.ts`：deterministic order、partial failure、successful-only push。
- `GitHistoryPanel.test.tsx`：multi repository picker 显示、repository-root selection，以及切仓后 branch/history/detail payload、左侧 worktree scope prop 与 root label 刷新。
- `GitHistoryWorktreePanel.test.tsx`：真实组件 A→B 切仓后旧文件消失、新文件出现，status/stage/commit/generation payload 使用 B 的 `repositoryRoot`；覆盖 in-flight mutation、in-flight generation、same-path selection 与 summary reset；legacy single mode 保持旧调用 arity。
- `GitDiffPanel.test.tsx` / `GitMultiRepositoryChanges.test.tsx`：content precedes bottom composer。
- `GitDiffPanel.test.tsx` / `GitMultiRepositoryChanges.test.tsx`：repository-scoped modal preview、same-relative-path stale response isolation 与 full diff scope。
- `git-commit-composer-layout.test.ts`：multi repository header density 复用 single repository file-row tokens。
- `src/services/tauri.test.ts`：`repositoryRoot` payload mapping。
- Rust `scoped_git_root_is_cross_platform_and_stays_inside_workspace`：empty/nested/escape/unknown root boundary。

## Validation

```bash
npm run typecheck
npm run check:runtime-contracts
npm exec vitest run src/features/git/components/GitMultiRepositoryChanges.test.tsx \
  src/features/git/hooks/useMultiRepositoryGitStatus.test.tsx \
  src/features/git/utils/multiRepositoryCommit.test.ts
cargo test --manifest-path src-tauri/Cargo.toml scoped_git_root_is_cross_platform_and_stays_inside_workspace
```
