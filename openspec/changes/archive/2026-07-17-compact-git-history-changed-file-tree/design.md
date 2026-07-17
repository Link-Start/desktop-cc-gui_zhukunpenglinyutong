## Context

`buildFileTreeItems()` currently rebuilds a Git History-specific directory tree and contains a `collapseDirChain()` placeholder that returns its input unchanged. Therefore every path segment becomes one visible row. The Git domain already owns a tested generic projection in `src/features/git/utils/diffTree.ts`: `buildDiffTree()` normalizes POSIX/Windows separators and `compactDiffTree()` recursively joins safe single-child folder chains while preserving the deepest canonical `path` and unique `key`.

The Git History helper is consumed by both selected-commit details and Push Preview. Its visible row model additionally owns repository-root projection and `expandedDirs` lookup, so the change must reuse the shared compact tree without moving UI state into the shared utility.

## Goals / Non-Goals

**Goals:**

- Reuse the canonical Git `Compact Folders` algorithm.
- Keep visible depth based on compact rows rather than raw path segment count.
- Keep expansion identity on the compact chain's deepest canonical path.
- Preserve repository-root, file identity, sorting and all existing row interactions.
- Cover structural and path compatibility boundaries with pure tests.

**Non-Goals:**

- No backend, IPC, payload, persistence or i18n changes.
- No new preference flag or alternate tree mode.
- No header/status/stat/row visual redesign.
- No changes to progressive workspace file-tree semantics.

## Decisions

### Decision 1: Reuse `buildDiffTree()` and `compactDiffTree()`

`buildFileTreeItems()` SHALL adapt the shared `DiffTreeFolderNode<GitCommitFileChange>` into its existing `FileTreeItem[]` output.

Alternative: implement a local `while` loop inside the existing placeholder. Rejected because it duplicates separator normalization, compact identity and collision handling already tested by the Git feature.

### Decision 2: Use deepest canonical path as expansion key

A compact label such as `main.java.com.example` is presentation only. Folder row `id`, toggle payload and `expandedDirs` lookup SHALL use the deepest path (`main/java/com/example`). This matches the shared utility and prevents labels containing dots from becoming ambiguous identities.

Alternative: join labels and use the display string as key. Rejected because `a.b` and `a/b` can render the same label.

### Decision 3: Preserve root as an explicit non-compact boundary

`FILE_TREE_ROOT_PATH` remains a synthetic root row and uses `/`, which cannot collide with a Git-relative changed-file directory path. Compaction starts below it so repository naming and root collapse behavior do not change.

Alternative: fold the repository name into the first directory chain. Rejected because it removes the stable repository scope shown in the current Git History panel.

### Decision 4: Keep existing output contract

The `FileTreeItem` union and component rendering remain unchanged. Only the pure projection feeding the view changes. This limits compatibility risk across selected-commit details and Push Preview.

## Data Flow

```text
GitCommitFileChange[]
  -> buildDiffTree(files, stableSectionKey)
  -> compactDiffTree(root)
  -> walk compact folders/files
  -> FileTreeItem[]
  -> existing DiffFolderRow / DiffFileRow
```

Compaction stops when the current folder has direct files or its child-folder count is not exactly one. The resulting `depth` increments once per visible compact row.

## Risks / Trade-offs

- [Shared utility behavior changes later] → focused Git History tests pin required boundary behavior and output identity.
- [Existing expanded set contains every raw directory path] → deepest compact path is already present because `collectDirPaths()` records every ancestor.
- [Windows path regression] → shared builder normalizes `\`; add a History-specific regression assertion.
- [Dotted labels collide visually] → keep shared unique key/path and assert distinct row ids.
- [Push Preview visual rows become more compact] → intentional consistency because it consumes the same helper; file selection and diff opening remain path-based.

## Migration Plan

1. Replace the local tree construction with the existing shared builder/compactor.
2. Extend pure helper tests before UI-level validation.
3. Run focused Git History tests, lint, typecheck and strict OpenSpec validation.
4. Rollback by reverting the helper adapter and tests; no data migration is required.

## Open Questions

无。用户已确认 dot-separated Compact Folders、边界与兼容性要求。
