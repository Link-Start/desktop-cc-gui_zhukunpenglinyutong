# Verification: add-file-history-view

## Status

**READY FOR ARCHIVE** — 24/24 tasks complete. Automated gates pass for the
File History scope, and the user explicitly accepted the desktop smoke result.

## Automated Evidence (2026-07-17)

- [x] `npm run lint` — clean, zero warnings.
- [x] `./node_modules/.bin/tsc --noEmit --pretty false` — clean.
- [x] Focused Vitest for `FileHistoryView`, file Git scope, FileTree entry,
  AppShell routing, and layout contract — 5 files / 96 tests passed.
- [x] The broader focused frontend set covering service mapping, detached
  explorer, layout nodes, DesktopLayout, AppShell contexts, and i18n — 223 tests
  passed before the final four retry-state cases were added; those four cases
  also pass in the current focused run.
- [x] `cargo test --manifest-path src-tauri/Cargo.toml file_history --lib` —
  3 passed, including rename-follow, invalid path, and snapshot identity.
- [x] `cargo test --manifest-path src-tauri/Cargo.toml --bin cc_gui_daemon file_history`
  — daemon target compiled successfully; 0 matching tests, 868 filtered out.
- [x] `npm run check:runtime-contracts` — AppShell and Git History contracts pass.
- [x] `openspec validate add-file-history-view --strict --no-interactive` — valid.

### Adaptive layout + aligned compare increment

- [x] `FileHistoryView.test.tsx` — 6 passed, including exact selected
  `filePath/diff` forwarding into the shared aligned read-only compare and
  image-entry fallback to the shared image-capable viewer.
- [x] `WorkspaceReadOnlyDiffCompare.test.ts` — 5 passed, covering
  previous/source reconstruction, read-only columns, navigation, and stale
  full-diff rejection.
- [x] `file-history-layout.test.ts` — 3 passed, covering named container,
  bounded wide layout, narrow stacking, and fluid two-pane columns.
- [x] `npm run lint` — clean, zero warnings after the increment.
- [x] `./node_modules/.bin/tsc --noEmit --pretty false` — clean after the increment.
- [x] `npm run check:runtime-contracts` — AppShell and Git History contracts pass.
- [x] `git diff --check` and scoped `console.log` / `any` / non-null assertion scan — clean.
- [x] `openspec validate add-file-history-view --strict --no-interactive` — valid after artifact update.

### Read-only Diff decoration fix

- [x] Root cause confirmed: `readOnlyReason` selected
  `.file-compare-readonly-content`, so CodeMirror marker DOM never existed;
  `loadFileHistoryStyles()` already loaded the required CSS.
- [x] `WorkspaceReadOnlyDiffCompare` now keeps normal historical columns on
  CodeMirror with `editable=false`, deletion tone on previous, and addition
  tone on source.
- [x] `CompareEditorColumn` now permits programmatic difference navigation for
  read-only CodeMirror while preserving plain-text fallback for explicit
  unsupported/truncated/error states.
- [x] Focused Vitest — 6 files / 36 tests passed, covering render gate,
  no-mutation, semantic tone, markers, navigation, style selectors, existing
  editable compare, and File History regressions.
- [x] `npm run lint` — clean, zero warnings.
- [x] `./node_modules/.bin/tsc --noEmit --pretty false` — clean.
- [x] `npm run check:runtime-contracts` — AppShell and Git History contracts pass.
- [x] `git diff --check` — clean.
- [x] `openspec validate add-file-history-view --strict --no-interactive` — valid after final task and evidence writeback.

### Review closure: rename identity, line coordinates, binary parity

- [x] Path-scoped history now returns each commit's repository-relative
  `filePath`; selecting a pre-rename commit requests and exact-matches that
  historical path, with no `diffs[0]` fallback.
- [x] Historical read-only CodeMirror gutters now use unified-patch old/new
  coordinates across non-1 and multi-hunk diffs; separator rows use blank labels.
- [x] Desktop local and remote daemon selected-commit image mapping share one
  helper with old/new MIME and base64 payload parity; non-image binary entries
  render an explicit binary state.
- [x] Focused Vitest — 3 files / 18 tests passed.
- [x] `cargo test --manifest-path src-tauri/Cargo.toml file_history --lib` —
  3 passed, including exact pre/post-rename commit paths.
- [x] `cargo test --manifest-path src-tauri/Cargo.toml image_commit_diff --lib` —
  1 passed, covering shared old/new image payloads.
- [x] `cargo check --manifest-path src-tauri/Cargo.toml --bin cc_gui_daemon` — passed.
- [x] `npm run lint`、`npm run typecheck`、`npm run check:runtime-contracts` — passed.
- [x] `npm run doctor:strict` — runtime contracts、branding 与 strict doctor passed.
- [x] `npm run check:large-files` — command passed in report mode；现存 baseline
  findings 被报告，本增量未新增超限 frontend file。
- [x] Scoped `rustfmt --check`、`git diff --check` 与 forbidden fallback/debug
  scan — clean.

## Full-suite Observation

`npm run test` reached batch 19/205 and stopped on the unrelated
`Sidebar.styles.test.ts` contract for `.fvp-tab.is-active::after`. The current
working tree contains concurrent File View / Git Blame work, and this proposal
does not own either the failing test or that active-tab CSS contract. The
failure is recorded rather than repaired across another change boundary.
The focused failing test was rerun after this increment and remains unchanged;
all 14 tests owned by the adaptive File History increment pass.

## Manual Gate

- [x] Desktop smoke accepted by the user after File History layout、diff style、
  read-only compare 与 navigation review.

## Archive Decision

The change is ready for archive. The unrelated full-suite Sidebar style failure
remains independently attributed and is not included in this proposal's green claim.
