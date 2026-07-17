## 1. Dependency And Alignment Adapter

- [x] 1.1 [P0][depends:none][I: root package manifest + existing lockfile transitive jsdiff][O: `diff@^8.0.3` becomes an explicit runtime dependency without unrelated package churn][V: `npm install` completes and package/lock diff only declares the dependency] Declare jsdiff as a direct dependency.
- [x] 1.2 [P0][depends:1.1][I: large `baseLines` / `targetLines` above `ALIGNMENT_CELL_LIMIT`][O: bounded `diffArrays` adapter emits existing `pair` / `target-only` / `base-only` operations and preserves likely replacement pairing][V: focused pure-helper tests] Replace the index-only large-file alignment path.

## 2. Regression Coverage

- [x] 2.1 [P0][depends:1.2][I: ~4,000-line files with a 14-line early insertion and distant multi-hunk edits][O: changed rows/markers/gaps cover only real changes and unchanged suffixes realign][V: `fileCompareDiff.test.ts` assertions] Add large-file pure alignment regressions.
- [x] 2.2 [P1][depends:2.1][I: editable modal compare using a large-file 14-line insertion fixture][O: changed rows remain 14 while the UI difference counter renders one contiguous block as `1 / 1`][V: `WorkspaceEditableDiffCompare.test.tsx`] Add the editable review boundary regression.

## 3. Quality Gates

- [x] 3.1 [P0][depends:2.1,2.2][I: implementation + focused tests][O: focused Vitest, typecheck, lint, large-file gate and `git diff --check` pass][V: command exit codes] Run frontend quality gates.
- [x] 3.2 [P0][depends:3.1][I: completed artifacts and implementation][O: strict change validation passes and task status matches implementation][V: `openspec validate fix-large-file-editable-diff-alignment --strict --no-interactive`] Validate the OpenSpec change.

## 4. Block Navigation And Popup Header

- [x] 4.1 [P0][depends:1.2][I: aligned `changedRows`][O: shared `changedBlocks` groups adjacent rows and keeps each block's first row as anchor][V: `fileCompareDiff.test.ts`] Add block-level navigation data without changing line markers.
- [x] 4.2 [P0][depends:4.1][I: `changedBlocks`][O: workspace compare and editable modal counters/navigation consume blocks][V: focused component tests] Switch navigation consumers to block semantics.
- [x] 4.3 [P1][depends:4.2][I: popup `headerControlsTarget`][O: navigator portals into the single modal header before view controls; embedded fallback keeps local nav][V: DOM structure and focused UI assertions] Merge popup navigation into the header row.
- [x] 4.4 [P0][depends:4.1,4.2,4.3][I: implementation and updated artifacts][O: focused Vitest, typecheck, lint, `git diff --check`, large-file gate and strict OpenSpec validation pass][V: command exit codes] Run quality gates.

## 5. Compact Column Headers And Gap Texture

- [x] 5.1 [P1][depends:4.3][I: existing role/path spans and optional actions][O: shared compare column header renders one line with bounded path ellipsis][V: CSS contract inspection and focused compare regression] Compact the column header.
- [x] 5.2 [P1][depends:1.2][I: `cm-file-compare-line-gap` block widget][O: alignment gaps retain height/background and add subtle texture without affecting source lines][V: focused editor regression and visual selector audit] Add CSS-only gap texture.
- [x] 5.3 [P0][depends:5.1,5.2][I: implementation and updated artifacts][O: focused Vitest, typecheck, lint, `git diff --check`, large-file gate and strict OpenSpec validation pass][V: command exit codes] Run quality gates.

## 6. Diagonal Gap Hatch Correction

- [x] 6.1 [P1][depends:5.2][I: horizontal dashed gap treatment][O: gap uses a low-contrast 135-degree repeating hatch with no pseudo-element or mask][V: CSS selector audit] Replace horizontal rules with diagonal hatching.
- [x] 6.2 [P0][depends:6.1][I: corrected styles and artifacts][O: focused Vitest, lint, `git diff --check` and strict OpenSpec validation pass][V: command exit codes] Run correction quality gates.

## 7. Pixel-Accurate Gap Height

- [x] 7.1 [P0][depends:5.2][I: gap count plus editor line-height contract][O: gap removes the hard-coded `1.55em` multiplier; final geometry source is refined by task 9.1][V: CSS contract audit plus existing single/multi-gap regressions] Align virtual gap height with editor lines.
- [x] 7.2 [P0][depends:7.1][I: corrected metric and artifacts][O: focused Vitest, typecheck, lint, `git diff --check` and strict OpenSpec validation pass][V: command exit codes] Run pixel-alignment quality gates.

## 8. Fixed Column Header Geometry

- [x] 8.1 [P0][depends:5.1][I: read-only header without actions plus editable header with 28px Save button][O: both headers use a 36px border-box and both editors start at the same Y coordinate][V: CSS dimension audit] Stabilize compare header geometry.
- [x] 8.2 [P0][depends:8.1][I: fixed header styles and artifacts][O: focused Vitest, typecheck, lint, CSS contract audit, `git diff --check` and strict OpenSpec validation pass][V: command exit codes] Run header-alignment quality gates.

## 9. Runtime-Measured Gap Geometry

- [x] 9.1 [P0][depends:7.1][I: gap line count plus CodeMirror `view.defaultLineHeight`][O: widget DOM height is written in measured pixels during create/update and CSS no longer owns geometry][V: pure height regression plus selector audit] Move gap geometry to the CodeMirror measurement boundary.
- [x] 9.2 [P0][depends:9.1][I: repeated Java method anchors and asymmetric gaps before `verifyPassword`][O: previous line 124 and current line 105 resolve to the same aligned row while 19 virtual rows use measured height][V: focused alignment regression] Lock the reported Java structure regression.
- [x] 9.3 [P0][depends:9.1,9.2][I: implementation and artifacts][O: focused Vitest, typecheck, lint, large-file gate, `git diff --check` and strict OpenSpec validation pass][V: command exit codes] Run runtime-geometry quality gates.

## 10. Full-Diff Editable Modal Recovery

- [x] 10.1 [P0][depends:2.2][I: truncated Git preview patch plus workspace-backed editable file][O: baseline reconstruction retries once with `getGitFileFullDiff`; successful full patch stays on editable compare and stale results are ignored][V: `WorkspaceEditableDiffCompare.test.tsx`] Recover editable compare from the full diff.
- [x] 10.2 [P0][depends:10.1][I: recovery implementation and updated artifacts][O: focused Vitest, typecheck, lint, `git diff --check`, large-file gate and strict OpenSpec validation pass][V: command exit codes] Run full-diff recovery quality gates.
- [x] 10.3 [P0][depends:10.1][I: baseline request failure or unreconstructable full patch][O: editable compare remains mounted, previous column reports unavailable, and legacy patch body is never rendered][V: compare and review-surface focused regressions] Remove the legacy fallback branch.
- [x] 10.4 [P0][depends:10.3][I: minimal renderer switch and corrected artifacts][O: focused Vitest, typecheck, lint, large-file gate, `git diff --check`, and strict OpenSpec validation pass][V: command exit codes] Run renderer-switch quality gates.

## 11. Cross-Platform Save And Extreme Alignment Boundaries

- [x] 11.1 [P0][depends:1.2][I: large insertion above `LARGE_ALIGNMENT_MAX_EDIT_LENGTH` plus shared suffix][O: unique-anchor fallback realigns the suffix with bounded memory instead of index-only drift][V: `fileCompareDiff.test.ts`] Harden the bounded alignment fallback.
- [x] 11.2 [P0][depends:none][I: uniform CRLF/CR source plus CodeMirror LF edit payload][O: shared save boundary restores disk line endings while editor dirty/cache state stays canonical][V: `useFileDocumentState.test.tsx`] Preserve cross-platform line endings on save.
- [x] 11.3 [P0][depends:11.1,11.2][I: implementation and updated artifacts][O: focused Vitest, typecheck, lint, large-file gate, `git diff --check`, and strict OpenSpec validation pass][V: command exit codes] Run boundary quality gates.
