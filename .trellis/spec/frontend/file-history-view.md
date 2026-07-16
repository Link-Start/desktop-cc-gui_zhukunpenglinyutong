# File History View Cross-Layer Contract

本规范固化单文件 Git history 从 FileTree 到 Desktop/daemon backend 的 executable contract，适用于 `src/features/files/**`、`src/features/git-history/**`、`src/services/tauri/git.ts`、`src-tauri/src/git/commands.rs`、`src-tauri/src/shared/git_core.rs` 与 `src-tauri/src/bin/cc_gui_daemon*`。

## 1. Scope / Trigger

- Trigger：修改 FileTree 文件历史入口、`FileHistoryTarget`、`getGitCommitHistory` 的 `path`、snapshot identity、rename-follow、remote forwarding、File History layout 或 selected diff renderer。
- 目标：root/nested repository 都只查询目标文件，Desktop local 与 remote daemon 保持 payload/response parity。
- 禁止：frontend 遍历 commits 后逐个拉 diff 做 N+1 filtering；禁止把 file mode 塞入通用 `GitHistoryPanelImpl`。

## 2. Signatures

```ts
export type FileHistoryTarget = {
  workspaceId: string;
  workspacePath: string;
  repositoryRoot: string;
  path: string;
  displayPath: string;
};

getGitCommitHistory(workspaceId, {
  path?: string | null;
  repositoryRoot?: string | null;
  snapshotId?: string | null;
  offset?: number;
  limit?: number;
}): Promise<GitHistoryResponse>

getGitCommitDiff(workspaceId, sha, {
  path?: string | null;
  repositoryRoot?: string | null;
}): Promise<GitCommitDiff[]>

WorkspaceReadOnlyDiffCompare({
  filePath: string;
  diff: string;
  loadFullDiff?: ((path: string) => Promise<string>) | null;
  useFullDiff?: boolean;
}): JSX.Element

CompareEditorColumn({
  draft: CompareColumnDraft;
  markers: GitLineMarkers;
  lineGaps: FileCompareLineGap[];
  activeLineNumber: number | null;
  diffTone?: "deletion" | "addition" | null;
}): JSX.Element
```

```rust
async fn get_git_commit_history(
    workspace_id: String,
    branch: Option<String>,
    query: Option<String>,
    author: Option<String>,
    date_from: Option<i64>,
    date_to: Option<i64>,
    snapshot_id: Option<String>,
    path: Option<String>,
    offset: Option<usize>,
    limit: Option<usize>,
    repository_root: Option<String>,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<GitHistoryResponse, String>
```

Daemon method 使用同字段顺序与语义，其中 pagination 的 `offset/limit` 为解析后的 `usize`。RPC payload 使用 camelCase `workspaceId/snapshotId/repositoryRoot`，`path` 保持 repository-relative normalized path。

## 3. Contracts

- `path === undefined/null`：保持 repository-wide revwalk、filters、pagination 与 DTO，不执行 `git log --follow`。
- `path` present：先 normalize/validate，再以受控 argv 执行 `git log --follow --format=%H <ref> -- <path>`；只接受 40 位 hex OID，再由 `git2` 映射 `GitHistoryCommit`。
- `repositoryRoot === ""` 是 explicit workspace-root identity，禁止 truthy fallback；nested root 选择 longest path match，传给 backend 的 `path` 必须剥离 root prefix。
- snapshot identity MUST 包含 HEAD、branch/query/author/date filters、`repositoryRoot` 与 normalized `path`；另一个 path 复用 snapshot 必须报 expired/mismatch。
- Desktop remote forwarding 与 daemon dispatch MUST 原样保留 optional `path` 和 `repositoryRoot`。
- `FileHistoryView` 首屏固定请求 100 条，只为 selected commit 请求 diff；history target 与 selected commit 分别使用 generation guard 拒绝 stale response。
- selected text diff MUST 复用 `WorkspaceReadOnlyDiffCompare`，输出“上个版本 / 源代码”aligned CodeMirror panes；image entry MUST 保留 shared `GitDiffViewer` image rendering。File History 不得创建第二套 diff parser/renderer，也不得把历史内容变成 editable。
- normal read-only compare MUST use `editable=false` + `readOnlyReason=null`，因此仍进入 `FileCodeMirrorEditor`；`readOnlyReason/error/truncated` 才允许触发 `.file-compare-readonly-content` fallback。禁止把 read-only 与 plain-text renderer 绑定。
- previous column MUST pass `diffTone="deletion"`，source column MUST pass `diffTone="addition"`。Scoped CSS MUST 将 changed lines 分别渲染为 red/green，同时保留 shared markers、aligned gaps 与 syntax highlighting。
- difference navigation MUST work for read-only CodeMirror。`CompareEditorColumn` 只在 plain-text fallback 时跳过 programmatic selection/scroll，不得仅因 `editable=false` 跳过。
- `.file-history-view` MUST 是 named inline-size container。Workbench 宽屏使用 bounded commit rail + `minmax(0, 1fr)` diff；narrow threshold MUST 基于 container 而不是 viewport。
- File History scope MUST 将 `.editable-diff-compare-columns` 和 `.file-compare-column` 的 fixed minimum 收敛为 `minmax(0, 1fr)` / `min-width: 0`，让 compare 消费剩余宽度；long lines 由 CodeMirror pane 自己滚动。
- `loadFileHistoryStyles()` MUST 同时加载 diff、file-view compare 和 file-history styles。
- `FileTreePanel.onOpenFileHistory` MUST optional；callback 缺失、folder target、invalid/escaping path、没有 owning repository 时不显示入口。

## 4. Validation & Error Matrix

| 输入/事件 | 必须行为 | Error/UI settle |
|---|---|---|
| omitted `path` | repository-wide history | existing callers 无回退 |
| `src/main.ts` + root repo | `repositoryRoot=""`, `path="src/main.ts"` | file-only commits |
| `packages/app/src/main.ts` + nested repos | longest root=`packages/app`, path=`src/main.ts` | child repository history |
| Windows separators | normalize `\\` 为 `/` | 与 POSIX path 等价 |
| absolute、drive prefix、empty、`.`、`..` | backend reject before Git query | explicit readable error |
| rename chain | Git `--follow` OID sequence | 包含 rename 前 commits |
| file A request 后切 file B | A late response ignored | B commits/error/diff 不变 |
| commit A diff 后切 commit B | A late diff ignored | B diff/error 不变 |
| path/snapshot mismatch | reject pagination | UI 可 Retry 首屏 |
| remote mode | exact camelCase payload forwarded | daemon state is source of truth |
| wide host container | commit rail bounded，compare fills remainder | 不得留下空白列或让 diff width 跟内容走 |
| narrow host container | history rail stacks above full-width compare | 不得依赖 `100vw`/viewport media query |
| selected text diff | previous/source read-only panes + synchronized compare | 不得允许 edit 或复制 shared renderer |
| selected image diff | shared image-capable viewer | 不得把 image entry 送进 CodeMirror 空文本列 |
| normal read-only text | CodeMirror + decorations + `editable=false` | 不得因 read-only reason 渲染 `<pre>` |
| previous/source change | red deletion / green addition | 不得两栏都显示 generic blue modified |
| difference navigation | read-only editor scrolls to active line | 不得把 programmatic navigation 当 mutation 禁用 |
| long source line | editor-local horizontal scroll | 不得撑宽 File History workspace |

## 5. Good / Base / Bad Cases

- Good：`packages/app/src/main.ts` → `{ repositoryRoot: "packages/app", path: "src/main.ts" }` → daemon `git log --follow` → selected commit scoped diff。
- Base：`getGitCommitHistory(workspaceId)` 继续发送 `path: null`，backend 使用原 revwalk。
- Bad：nested repository 仍发送 workspace-relative `packages/app/src/main.ts`，导致 child repo query empty。
- Bad：用 `if (repositoryRoot)` 判断 scope，吞掉合法 root identity `""`。
- Bad：history/diff promise resolve 后不核对 generation，旧文件或旧 commit 覆盖当前 UI。
- Good：File History container 变窄时，layout 自己切换上下结构，right panel 是否打开不影响 breakpoint truth。
- Good：historical text column 使用 `{ editable: false, readOnlyReason: null }`，因此 CodeMirror/markers 保留但 user mutation 被禁用。
- Bad：用 `@media (max-width: ...)` 推断 center surface 宽度，导致 window 很宽但 center panel 很窄时仍保持左右挤压。
- Bad：为复刻 Diff UI 再写一套 previous/source reconstruction 或 CodeMirror columns。
- Bad：用 `readOnlyReason: t("files.readOnly")` 表示普通只读，意外触发 `<pre>` fallback 并丢失全部 decorations。

## 6. Tests Required

- `src/services/tauri.test.ts`：assert omitted payload 为 `path:null`；scoped payload 同时包含 exact `path/repositoryRoot`。
- `fileGitScope.test.ts`：assert root、longest nested、Windows、escape、no-match。
- `FileTreePanel.run.test.tsx`：assert root/nested file submenu payload；callback omitted 时无 Git dead entry。
- `FileHistoryView.test.tsx`：用 deferred promises assert rapid file switch 与 commit switch 丢弃 late response。
- `FileHistoryView.test.tsx`：assert selected entry 的 exact `filePath/diff` 传给 shared aligned read-only compare。
- `WorkspaceReadOnlyDiffCompare.test.ts`：assert previous/source reconstruction、read-only columns、difference navigation 与 stale full-diff guard。
- `WorkspaceFileComparePanel.compare-editor.test.tsx`：assert normal read-only draft renders CodeMirror with `editable=false`、semantic tone/markers、navigation dispatch；explicit unsupported reason retains plain-text fallback。
- `file-history-layout.test.ts`：assert named container、bounded wide grid、narrow stacked rows、fluid two-pane column override。
- `file-history-layout.test.ts`：assert deletion/addition scoped selectors 与 red/green theme colors 存在。
- `useGitPanelController.test.tsx`：assert open/switch/close 与切换其他 center surface 后 target 清空。
- Rust `git::tests`：真实 repository fixture assert root rename-follow、invalid paths 与不同 path snapshot identity。
- Gate：`npm run typecheck`、focused Vitest、`cargo test ... file_history --lib`、daemon target compile、`npm run check:runtime-contracts`、strict OpenSpec validation。

## 7. Wrong vs Correct

### Wrong

```ts
const repository = repositories.find((entry) => filePath.startsWith(entry.repositoryRoot));
await getGitCommitHistory(workspaceId, { path: filePath });
```

这会选到较短 parent root，并把 workspace-relative path 错传给 nested repository。

### Correct

```ts
const scope = resolveFileGitScope(filePath, repositories);
if (scope) {
  await getGitCommitHistory(workspaceId, scope);
}
```

resolver 统一 separator/escape validation，并用 longest repository-root match 生成 exact boundary payload。

### Wrong: viewport sizing + duplicated renderer

```tsx
<MyHistoricalDiff oldText={oldText} newText={newText} />
```

```css
@media (max-width: 760px) {
  .file-history-workbench { grid-template-columns: 190px 1fr; }
}
```

### Correct: container sizing + shared renderer

```tsx
<WorkspaceReadOnlyDiffCompare filePath={target.path} diff={selectedDiff.diff} />
```

```css
.file-history-view { container: file-history / inline-size; }
.file-history-workbench {
  grid-template-columns: clamp(240px, 26%, 360px) minmax(0, 1fr);
}
@container file-history (max-width: 720px) {
  .file-history-workbench { grid-template-columns: minmax(0, 1fr); }
}
```

### Wrong: read-only 触发 renderer fallback

```ts
const draft = {
  editable: false,
  readOnlyReason: t("files.readOnly"),
};
```

### Correct: mutation capability 与 renderer capability 分离

```tsx
const draft = {
  editable: false,
  readOnlyReason: null,
};

<CompareEditorColumn
  draft={draft}
  markers={markers}
  diffTone="deletion"
  activeLineNumber={activeLineNumber}
/>
```
