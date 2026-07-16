# Verification: add-file-history-view

## Status

**NOT READY FOR ARCHIVE** — 19/20 tasks complete. Automated gates pass for the
File History scope; manual desktop smoke remains pending.

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

## Full-suite Observation

`npm run test` reached batch 19/205 and stopped on the unrelated
`Sidebar.styles.test.ts` contract for `.fvp-tab.is-active::after`. The current
working tree contains concurrent File View / Git Blame work, and this proposal
does not own either the failing test or that active-tab CSS contract. The
failure is recorded rather than repaired across another change boundary.
The focused failing test was rerun after this increment and remains unchanged;
all 14 tests owned by the adaptive File History increment pass.

## Outstanding Manual Gate

- [ ] Desktop smoke: root and nested repository file context menus, rename
  history, rapid commit switching, previous/source aligned rendering, wide and
  narrow container resizing, red/green changed-line decorations, read-only
  navigation, retry states, and close/back behavior.

## Archive Decision

Do not archive until the manual desktop smoke is accepted. The unrelated full
suite failure should also be resolved or independently attributed before a
repository-wide green claim is made.
