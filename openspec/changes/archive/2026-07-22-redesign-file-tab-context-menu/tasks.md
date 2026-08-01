## 1. Shared menu foundation

- [x] 1.1 [P0, depends: none] Input: existing `RendererContextMenu` item types; output: backward-compatible optional icon rendering for leaf/submenu items; verify with focused component tests and accessible label assertions.
- [x] 1.2 [P1, depends: 1.1] Input: shared menu DOM contract; output: theme-token icon slot and Chrome-like file-tab menu styling without changing existing callers; verify with CSS visual contract tests.

## 2. Atomic tab state actions

- [x] 2.1 [P0, depends: none] Input: main workspace tab state; output: `handleCloseOtherFileTabs(path)` scoped by `fileTabWorkspaceKey`; verify target retention, activation and invalid-target no-op in `useGitPanelController.test.tsx`.
- [x] 2.2 [P0, depends: none] Input: detached explorer tab state; output: atomic `closeOtherTabs(path)`; verify session-local target retention and navigation cleanup in a focused hook test.
- [x] 2.3 [P1, depends: 2.1, 2.2] Input: new state actions; output: callback wiring through layout and detached explorer props; verify TypeScript compile and existing boundary tests.

## 3. Target-aware file tab context menu

- [x] 3.1 [P0, depends: 1.1, 2.3] Input: clicked tab path and pointer coordinates; output: `RendererContextMenuState` with Git、close-current、close-other、close-all and detached-open groups; verify background-tab targeting and disabled state in `FileViewPanel.test.tsx`.
- [x] 3.2 [P0, depends: 3.1] Input: target Git scope; output: read-only file history and Git Blame submenu using existing capabilities; verify nested repository target mapping、unavailable action guard and background-tab blame activation.
- [x] 3.3 [P1, depends: 3.1] Input: localized menu labels; output: all locale dictionaries updated without hardcoded visible copy; verify locale key parity/typecheck.

## 4. Verification and closure

- [x] 4.1 [P0, depends: 1.2, 2.3, 3.2, 3.3] Run focused Vitest suites for shared menu、FileViewPanel、main tab controller、detached state and visual contract; fix regressions.
- [x] 4.2 [P0, depends: 4.1] Run `npm run lint`, `npm run typecheck`, `npm run check:large-files`, focused changed-scope tests and strict OpenSpec validation; full test suite skipped per user instruction; record results.
- [x] 4.3 [P1, depends: 4.2] Verify implementation against proposal/design/spec, sync `filetree-multitab-open` main spec, and archive the completed change.
