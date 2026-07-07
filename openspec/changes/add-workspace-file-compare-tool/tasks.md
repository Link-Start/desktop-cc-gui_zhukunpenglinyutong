## 1. Controller And Layout State

- [x] 1.1 P1: Add explicit file compare session state/actions to the center controller; input is either workspace file paths or scratch mode, output is a stable compare surface state; verify with controller hook tests.
- [x] 1.2 P1: Extend center mode/layout rendering so file compare occupies the center area without global composer overlap, and update every `centerMode` union/callsite (`AppLayout`, `DesktopLayout`, layout hooks, solo/workspace cycling helpers); verify with `DesktopLayout` / `useLayoutNodes` focused tests.
- [x] 1.3 P2: Ensure opening/closing compare preserves existing editor tabs and editor maximized state; verify with regression tests around editor tab state.

## 2. File Tree Entry

- [x] 2.1 P1: Add `onCompareFiles(paths: string[])` prop wiring from layout/controller into `FileTreePanel`; input is ordered selected file paths, output opens workspace compare mode.
- [x] 2.2 P1: Add file tree context menu item shown only when selected file count is >= 2 and <= supported limit; for >4 selected files show a readable shrink-selection prompt and never compare only the first 4; verify right-click inside/outside selected set behavior.
- [x] 2.3 P2: Add i18n keys for compare action, unsupported selection, too many files, and compare surface labels; verify no hardcoded user-facing copy remains.

## 3. Compare Surface

- [x] 3.1 P1: Add feature-local diff helper for 2-4 text inputs; input is column text snapshots, output is changed line ranges/alignment metadata; verify with pure unit tests.
- [x] 3.2 P1: Implement scratch compare panel with left/right editable panes and live diff highlighting; verify top menu action opens empty two-pane compare.
- [x] 3.3 P1: Implement workspace compare columns that read file content through existing file service and expose editable CodeMirror panes; verify loading, error, and unsupported file states.
- [x] 3.4 P1: Wire column save to existing workspace file write contract with dirty indicator and failure preservation; verify save success/failure with component or hook tests.
- [x] 3.4a P1: Cover same-file editor tab + compare column behavior so saving one surface does not silently clear the other unsaved draft.
- [x] 3.5 P2: Add next/previous difference navigation and synchronized scroll if implementation remains scoped; verify keyboard/mouse interaction does not break editing.

## 4. Top Tool Menu

- [x] 4.1 P1: Add `file-compare` extra action to the right/top tool command menu using existing `OpenAppMenuExtraAction` pattern; input is menu click, output opens scratch compare.
- [x] 4.2 P2: Allow the action to be pinned like other header actions unless UX review decides it should be non-pinnable; verify `OpenAppMenu` behavior.

## 5. Validation

- [x] 5.1 P1: Run focused tests for file tree menu, compare controller/layout, compare diff helper, and compare surface editing.
- [x] 5.2 P1: Run `npm run typecheck`.
- [x] 5.3 P1: Run `npm run lint`.
- [x] 5.4 P2: Run `npm run check:large-files` if new/edited files approach large-file thresholds or style files are touched.
- [x] 5.5 P1: Run `openspec validate add-workspace-file-compare-tool --strict --no-interactive`.
