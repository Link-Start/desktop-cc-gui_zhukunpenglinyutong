## 1. Reproduction and attribution

- [x] 1.1 [P0, depends: none] Reproduce the unbounded AppShell render/update feedback in the startup regression; confirm the pre-fix path exhausts the Node heap.
- [x] 1.2 [P0, depends: 1.1] Map the failing parent feedback path to `useQuickSwitcherRecentFiles` and record the root-cause referential-equality assertion in a focused hook regression.

## 2. Root-cause fix

- [x] 2.1 [P0, depends: 1.2] Make equivalent recent-file group updates idempotent at the shared Quick Switcher feedback source.
- [x] 2.2 [P1, depends: 2.1] Add the minimum counter-case coverage proving an actual recent-file change still reaches the Quick Switcher projection.
- [x] 2.3 [P1, depends: none] Restore the AppShell startup fixture contract for `workspaceActivity.timeline` without weakening production selectors.

## 3. Verification

- [x] 3.1 [P0, depends: 2.1, 2.2] Run focused Quick Switcher/Messages/diagnostics regression suites and the AppShell startup suite (7 suites, 42 tests passed).
- [x] 3.2 [P0, depends: 3.1] Run frontend typecheck, lint, and production build; confirm no new React #185 path or build warning caused by this change. Full test run was stopped at the user's request in favor of incremental verification.
- [x] 3.3 [P0, depends: 3.2] Run strict OpenSpec validation. Manual desktop reproduction is waived because the pre-fix loop is deterministically captured by AppShell startup OOM and the post-fix startup/focused suites converge.
