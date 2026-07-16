## Context

Workspace file tabs use workspace-relative paths, while Git status/diff/blame commands use paths relative to one repository. Single-repository mode can recover the missing projection from `workspace.settings.gitRoot`; multi-repository mode cannot, because two rows may both be named `pom.xml` and belong to different roots.

Current data flow has two breaks:

1. `GitMultiRepositoryChanges` receives `status.repositoryRoot`, but `DiffSection.onFileClick` is wired to a noop. The shared `onOpenFile` callback only accepts `path`, and `useGitPanelController` falls back to the configured single `gitRoot`.
2. `FileViewPanel` receives only `gitRoot`, even though `useLayoutNodes` already owns aggregate `gitRepositories`. Its Blame eligibility therefore rejects files outside the configured root.

Existing repository-scoped flows provide the reusable model: multi-repository preview and mutation callbacks carry `repositoryRoot` explicitly, while `resolveFileGitScope` already implements safe longest-prefix ownership for file history.

## Goals / Non-Goals

**Goals:**

- Preserve repository identity until the editor-open boundary, then produce exactly one workspace-relative tab path.
- Resolve file Blame scope from aggregate repository summaries with longest-prefix semantics.
- Keep single-repository behavior source-compatible and unchanged.
- Prove adjacent Git entrypoints are either repository-scoped or intentionally workspace-scoped.

**Non-Goals:**

- No backend command changes, repository switching, new persistence, or UI redesign.
- No generic navigation object abstraction beyond the optional repository override needed by Git-domain paths.
- No fallback from a known aggregate inventory to an unrelated configured repository.

## Decisions

### 1. Extend the existing Git-domain open contract

`OpenFileOptions` gains optional `repositoryRoot?: string | null`. `resolveEditorOpenPath` uses this override only when it is defined; otherwise it preserves the configured `workspace.settings.gitRoot` fallback used by single-repository callers.

The callback flow is:

```text
multi-repo row(repositoryRoot, repoPath)
  -> GitDiffPanel onOpenFile(repoPath, repositoryRoot)
  -> useLayoutNodes onOpenFile(repoPath, { pathDomain: "git", repositoryRoot })
  -> useGitPanelController
  -> workspaceRelativePath
```

Explicit empty string means workspace-root repository and MUST remain distinct from `undefined` (no override). This prevents accidental prefixing by the configured nested root.

Alternative rejected: pre-concatenate the workspace path inside `GitMultiRepositoryChanges`. That duplicates path projection and can be prefixed again by the shared Git-domain resolver.

### 2. Reuse longest-prefix ownership for Blame

`FileViewPanel` receives optional `gitRepositories` and calls existing `resolveFileGitScope(workspaceRelativeFilePath, gitRepositories)`.

- If the aggregate inventory is non-empty, it is authoritative: a matching scope enables Blame; no match disables it.
- If aggregate inventory is unavailable/empty, the existing `gitRoot` path remains the compatibility fallback.
- Nested repositories win over parent/root repositories through the helper's longest-prefix rule.

Alternative rejected: select the first matching repository. Aggregate results may contain both workspace root and nested roots, so first-match behavior depends on scan order and can blame the parent repository incorrectly.

### 3. Keep adjacent repository-scoped flows unchanged and cover them as audit evidence

The audit matrix distinguishes path domains:

| Entrypoint | Identity contract | Action |
|---|---|---|
| multi-repo row direct open | `repositoryRoot + repo path` | fix |
| multi-repo modal preview | `repositoryRoot + DiffFile` | preserve/test |
| stage / unstage / commit selection | `repositoryRoot + repo path(s)` | preserve/test |
| file tree decoration / history | longest-prefix `FileGitScope` | preserve/test |
| workspace tree / search / Project Map | workspace-relative path | preserve; no repository prefix |

This avoids broadening every file-open caller with repository semantics it does not own.

## Risks / Trade-offs

- **[Risk] `undefined`, `null`, and `""` repository roots collapse accidentally** → use `repositoryRoot === undefined` to choose fallback; pass explicit empty string through unchanged.
- **[Risk] aggregate repository scan is not ready** → retain existing `gitRoot` compatibility path only while inventory is empty; once known, never guess another owner.
- **[Risk] same relative filename opens the wrong tab** → test two repositories containing `pom.xml` and assert distinct workspace-relative tabs.
- **[Risk] callback signature change breaks single-repo callers** → add only an optional second argument and keep existing callers/tests unchanged.
- **[Trade-off] detached file explorer lacks aggregate repository summaries** → it continues using its single `gitRoot` snapshot; aggregate support is limited to the main workspace surface that owns repository inventory.

## Migration Plan

1. Add optional types and projection override with focused controller tests.
2. Wire repository-aware row click through existing components/layout.
3. Pass aggregate summaries to main `FileViewPanel` and reuse `resolveFileGitScope`.
4. Add regression/audit tests, then run focused tests, typecheck, lint and strict OpenSpec validation.

Rollback is a frontend-only revert of the optional callback/prop wiring. No stored data or backend API requires migration.

## Open Questions

无。现有 `GitRepositorySummary.repositoryRoot` 与 `resolveFileGitScope` 已提供所需 canonical identity。
