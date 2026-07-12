## 1. Layout Contract

- [x] 1.1 P0 Input: desktop editor maximized state. Output: outer composer does not render below content. Verify with `DesktopLayout.test.tsx`.
- [x] 1.2 P1 Input: existing split modes. Output: horizontal split and normal chat composer placement stay unchanged. Verify with existing layout tests.

## 2. Workspace File Tab Memory

- [x] 2.1 P0 Input: workspace switch with open file tabs. Output: tabs and active file are restored per workspace. Verify with `useGitPanelController.test.tsx`.
- [x] 2.2 P1 Input: close tab / close all / exit editor. Output: only current workspace file tab state is cleared or updated. Verify with focused hook tests.

## 3. Validation

- [x] 3.1 P0 Run focused Vitest suites for touched layout and controller files.
- [x] 3.2 P0 Run `npm run typecheck`.
- [x] 3.3 P1 Run `npm run check:large-files` because stylesheet/layout-adjacent behavior is touched.
- [x] 3.4 P1 Run `npm run lint`.
