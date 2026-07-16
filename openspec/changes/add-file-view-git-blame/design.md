## Context

`FileViewPanel` currently loads document content through `useFileDocumentState`, mounts `FileCodeMirrorEditorImpl` behind a lazy boundary, and loads Git diff markers as an independent guarded effect. CodeMirror owns urgent typing while React receives coalesced snapshots. Git commands must also work through Desktop Tauri and daemon/Web Service forwarding, including optional multi-repository scope.

Git Blame is history work with unpredictable repository cost. Coupling it to `read_workspace_file`, expanding every line into React elements, or rebuilding editor extensions on every response would regress the existing file-open and typing contracts.

## Goals / Non-Goals

**Goals:**

- Explicit opt-in blame for the active workspace text editor, with short per-line annotation and full current-line metadata.
- Zero blame command calls and zero blame gutter DOM while disabled.
- Compressed cross-layer payload, viewport-bounded rendering, stale-result cancellation, dirty-state invalidation and save-triggered refresh.
- Desktop/daemon parity and repository-relative path safety for nested Git roots.

**Non-Goals:**

- Persistent global enablement, automatic blame on every opened file, deep copy/move detection, or per-scroll range queries.
- Attribution of an unsaved in-memory draft to historical commits.
- Blame support for external spec/absolute files, binary preview surfaces, historical diff sources, or untracked files beyond an explicit unavailable state.

## Decisions

### 1. Separate bounded command and compressed hunk response

Add `get_git_file_blame(workspace_id, path, repository_root)` returning:

```text
GitFileBlameResponse {
  path: String,
  head_sha: String,
  line_count: usize,
  hunks: Vec<GitBlameHunk>,
}

GitBlameHunk {
  start_line: usize,
  line_count: usize,
  commit_sha: String,
  author: String,
  authored_at: i64,
  summary: String,
  original_path: Option<String>,
}
```

The backend reuses `git2::Repository::blame_file`; commit metadata is deduplicated by OID while mapping hunks. Work runs through `spawn_blocking` after workspace/repository scope resolution and outside state locks. Empty path, paths outside the selected repository, missing HEAD, untracked file and non-repository scope return stable contextual errors.

Alternative: `git blame --line-porcelain`. It supports rich CLI compatibility but adds process startup/parsing and duplicates existing git2 capability, so it is not selected.

### 2. Feature-local orchestration with latest-only request identity

`useFileGitBlame` owns `disabled | loading | ready | stale | error`. The request key contains workspace, repository root and repository-relative path. A monotonically increasing request id plus the existing file render token prevents file A results from committing after activation of file B.

Enable is current-tab/session state only. A small module-local LRU stores successful responses for instant tab revisit; save/external change/HEAD mismatch invalidates it. There is no timer or polling. Dirty transition keeps the editor responsive and marks the visible result stale; save success schedules exactly one refresh if blame remains enabled.

Alternative: store blame in AppShell/global tab state. Rejected because it broadens render dependencies and risks realtime/AppShell updates reconfiguring the editor.

### 3. CodeMirror Compartment with viewport gutter

All `@codemirror/*` runtime behavior stays in `FileCodeMirrorEditorImpl`. A stable `Compartment` is present in the editor extension list and is configured with `[]` while disabled. Enabling reconfigures it to a blame gutter; data changes use `StateEffect` instead of changing the parent extension array or editor key.

The response remains hunk-based. Visible line lookup uses binary search over sorted hunks. `GutterMarker.toDOM/updateDOM` renders only CodeMirror viewport rows. The compact gutter marker shows `YYYY-MM-DD author` at a stable width; the current line adds one line-end CodeMirror widget in editor content with short SHA, full local time and summary, so details never expand the gutter or shift the code column. Text is truncated with native title/accessible label, and no React element is created per document line.

### 4. Interaction boundary

The topbar exposes a discoverable toggle in edit mode. Right-clicking only the blame/line-number gutter opens the shared `RendererContextMenu` with the same checked semantic; the code content context menu remains native. Disabling immediately removes the gutter without clearing cache.

### 5. Performance and fallback contract

The disabled path returns before starting any command. Enabled loading begins only after editor content is mounted; loading/error cannot block the editor. No command is issued by typing, cursor movement, hover, selection or scroll. A bounded line-count/file-size policy uses the existing file snapshot metrics; over-budget files show an explicit unavailable reason rather than expanding an unbounded response.

Errors are local side-channel errors: the file stays editable, the gutter is removed or keeps a stale label, and no toast loop is emitted. Logs contain command/workspace/repository/path summary but never file content.

## Validation and Error Matrix

| Case | Expected result |
|---|---|
| Disabled normal file | no command, no blame gutter |
| Enabled tracked file | editor remains mounted; hunks appear asynchronously |
| File switch while pending | stale response dropped |
| Dirty draft | no request; current result marked stale |
| Save while enabled | at most one refreshed request |
| Scroll/hover/cursor/typing | zero additional requests |
| Nested repository | repositoryRoot scope and repo-relative path preserved |
| External/binary/untracked/non-Git | explicit unavailable state; file remains usable |
| Daemon mode | same camelCase payload and response as Desktop |
| Backend failure | localized inline error; no file read/editor failure |

## Risks / Trade-offs

- [Risk] A repository with one blame hunk per line can still produce a large response. → Mitigation: compressed hunk DTO, snapshot budget guard and explicit over-budget fallback.
- [Risk] Unsaved edits make disk blame line mapping incorrect. → Mitigation: mark stale immediately on dirty transition and refresh only after save; never pretend stale data is current.
- [Risk] React prop changes reconfigure or remount CodeMirror. → Mitigation: stable Compartment, effects for payload updates, retain existing `key={filePath}` only.
- [Risk] Desktop and daemon implementations drift. → Mitigation: forwarding matrix, RPC mapping tests and shared DTO semantics.
- [Risk] Replacing the editor context menu removes native editing actions. → Mitigation: bind custom menu only to gutter targets.

## Migration Plan

1. Add DTO/service/backend command with no frontend caller; validate Desktop and daemon parity.
2. Add disabled-by-default hook and CodeMirror compartment.
3. Add UI toggle/context menu and focused tests.
4. Run typing/file-open/runtime-contract/Rust checks and manual Tauri WebView verification.

Rollback is feature-local: remove the toggle/hook and blame compartment, then remove the unused command. Existing file read, save, diff marker and CodeMirror contracts remain unchanged.

## Open Questions

- Exact file-size/line-count cutoff will reuse current render-profile/snapshot buckets initially and may be tuned only with measured Tauri WebView evidence.
