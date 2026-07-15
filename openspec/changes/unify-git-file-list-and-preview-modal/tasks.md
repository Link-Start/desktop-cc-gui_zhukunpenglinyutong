## 1. Canonical changed-file renderer

- [x] 1.1 [P0][depends:none][I: three existing file models and tree renderers][O: canonical view model, adapters and shared topology helper][V: focused pure/component tests] Establish the shared changed-file contract.
- [x] 1.2 [P0][depends:1.1][I: existing `GitDiffPanelFileSections` rows][O: reusable flat/tree file and folder renderer with typed activation/actions][V: keyboard, collapse and action-isolation tests] Extract the shared renderer without service calls.

## 2. Surface migration

- [x] 2.1 [P0][depends:1.2][I: `GitDiffPanel` staged/unstaged lists][O: both flat/tree modes use shared renderer and restore preview wiring][V: `GitDiffPanel.test.tsx`] Migrate the main Source Control surface.
- [x] 2.2 [P0][depends:1.2][I: `GitHistoryWorktreePanel` duplicate rows/tree][O: shared renderer preserves mutation and inclusion actions][V: `GitHistoryWorktreePanel.test.tsx`] Migrate the Git History worktree surface.
- [x] 2.3 [P0][depends:1.2][I: `GitHistoryPanelView` commit file tree][O: read-only adapter uses shared renderer and emits preview activation][V: `GitHistoryPanel.test.tsx`] Migrate commit details.

## 3. Unified preview modal

- [x] 3.1 [P0][depends:2.1,2.2,2.3][I: existing editable review surface and three preview sources][O: shared modal host/source adapter renders `WorkspaceEditableDiffReviewSurface`][V: focused modal boundary tests] Build the reusable preview host.
- [x] 3.2 [P0][depends:3.1][I: three file activation commands][O: all entrypoints open the shared new preview and stale requests are ignored][V: entrypoint integration tests] Wire every changed-file surface to the new preview.
- [x] 3.3 [P1][depends:3.2][I: migrated entrypoints][O: legacy modal branches, duplicated state and dead row/tree implementations removed][V: `rg` symbol audit plus typecheck] Remove replaced code.
- [x] 3.4 [P0][depends:3.3][I: Git History commit preview legacy modal chrome][O: canonical single-line header controls portal with one close action][V: `GitHistoryPanel.test.tsx`] Remove the remaining Git History commit preview chrome drift.
- [x] 3.5 [P0][depends:3.4][I: Git History working-tree preview legacy modal chrome][O: canonical single-line editable header controls portal with one close action][V: `GitHistoryPanel.test.tsx`] Remove the remaining working-tree preview chrome drift.
- [x] 3.6 [P0][depends:3.5][I: Git History read-only commit patch][O: aligned read-only compare body independent from edit capability][V: surface and patch-source focused tests] Replace the remaining legacy read-only Diff body.

## 4. Verification

- [x] 4.1 [P0][depends:3.3][I: implementation][O: focused Vitest, typecheck, lint, large-file gate and `git diff --check` pass][V: command exit codes] Run frontend quality gates.
- [x] 4.2 [P0][depends:4.1][I: completed artifacts and implementation][O: strict OpenSpec validation passes][V: `openspec validate unify-git-file-list-and-preview-modal --strict --no-interactive`] Validate the change.

## 5. Read-only full-context rendering

- [x] 5.1 [P0][depends:3.6][I: existing aligned compare, full document draft and `fullDiffLoader`][O: region/full modes share aligned renderer; editable region folds unchanged lines without changing document value][V: focused component/editor tests] Restore full-context rendering and editable region presentation without adding a backend contract.
- [x] 5.2 [P0][depends:5.1][I: implementation and updated artifacts][O: focused tests, typecheck, lint, diff check and strict OpenSpec validation pass][V: command exit codes] Verify the full-context and editable region fix.
- [x] 5.3 [P0][depends:5.2][I: read-only commit preview controls][O: preview is fixed to legacy focused patch body, hides full mode and disconnects full loader][V: surface renderer-selection tests] Restrict read-only commit preview without changing editable preview.
- [x] 5.4 [P0][depends:5.3][I: implementation and artifacts][O: focused tests, typecheck, lint, diff check and strict validation pass][V: command exit codes] Verify the read-only region rollback.
