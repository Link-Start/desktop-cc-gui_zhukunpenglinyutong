## 1. Tree Projection

- [x] 1.1 `[P0][depends: none]` 输入 `GitCommitFileChange[]`，让 `buildFileTreeItems()` 复用 shared `buildDiffTree()` / `compactDiffTree()`；输出保持现有 `FileTreeItem[]` contract，并以 deepest canonical path 维护 compact folder identity。验证：focused helper tests。
- [x] 1.2 `[P0][depends: 1.1]` 保留 repository root、expanded directory lookup、folder-first/file-second sorting 与 visible compact depth；输出不改变 `DiffFolderRow` / `DiffFileRow` props contract。验证：现有 GitHistoryPanel interaction tests。

## 2. Boundary And Compatibility Tests

- [x] 2.1 `[P0][depends: 1.1]` 输入 single-chain、branched tree 与 direct-file boundary fixtures；输出分别覆盖 compact、stop-at-branch、stop-at-file 行为。验证：Vitest assertions on labels/depth/path。
- [x] 2.2 `[P0][depends: 1.1]` 输入 Windows separator、dotted-label collision 与 explicit repository root fixtures；输出稳定 hierarchy、distinct ids 与 root row。验证：Vitest assertions on canonical paths/ids/expanded state。
- [x] 2.3 `[P1][depends: 1.2,2.1,2.2]` 复核 selected commit 与 Push Preview 继续由 original file path 驱动 selection/open diff。验证：相关既有 tests 保持通过。

## 3. Verification

- [x] 3.1 `[P0][depends: 2.3]` 运行 focused Vitest、`npm run lint`、`npm run typecheck` 与 `git diff --check`；输出零新增诊断。
- [x] 3.2 `[P0][depends: 3.1]` 运行 `openspec validate compact-git-history-changed-file-tree --strict --no-interactive` 并核对实现与 scenarios；输出 valid/all tasks complete。
