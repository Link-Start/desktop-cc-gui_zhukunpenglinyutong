# Verification Report: unify-git-diff-file-context-menu-actions

## Summary

| Dimension | Result |
|---|---|
| Completeness | 8/8 tasks，2/2 requirements |
| Correctness | 12/12 scenarios mapped to implementation and focused tests |
| Consistency | proposal / design / delta spec / Trellis contract aligned |

Final assessment: no CRITICAL implementation or spec-alignment issues. The change is ready to sync and archive with the unrelated repository test baseline recorded below.

## Requirement Traceability

### Git Diff Changed-File Context Menus SHALL Be Unified

- Shared builder and stable action order：`src/features/git/components/GitDiffPanelFileContextMenu.ts:19`
- Single flat/tree host and section-aware target derivation：`src/features/git/components/GitDiffPanel.tsx:1673`
- Multi repository-aware host：`src/features/git/components/GitDiffPanel.tsx:1780`
- Multi row intent forwarding：`src/features/git/components/GitMultiRepositoryChanges.tsx:43`、`:262`、`:308`
- Stale file-menu invalidation without affecting other menu sources：`src/features/git/components/GitDiffPanel.tsx:894`、`:912`
- Builder regression：`src/features/git/components/GitDiffPanelFileContextMenu.test.ts:18`
- Single flat/tree、section matrix、disabled rows、presentation-only behavior：`src/features/git/components/GitDiffPanel.test.tsx:481`、`:537`、`:665`
- Multi disabled/error/missing-callback native-menu suppression：`src/features/git/components/GitDiffPanel.test.tsx:1007`
- Topology rerender invalidation：`src/features/git/components/GitDiffPanel.test.tsx:920`

### Git Diff File Context Actions MUST Preserve Repository And Section Scope

- Single same-section bulk target and discard confirmation：`src/features/git/components/GitDiffPanel.test.tsx:578`
- Multi same-path repository isolation and refresh-on-success：`src/features/git/components/GitDiffPanel.test.tsx:788`
- Explicit workspace-root `repositoryRoot === ""`：`src/features/git/components/GitDiffPanel.test.tsx:875`
- Multi discard confirmation and exactly-one refresh：`src/features/git/components/GitDiffPanel.test.tsx:1064`
- Child forwarding contract：`src/features/git/components/GitMultiRepositoryChanges.test.tsx:304`、`:355`、`:407`

## Design Consistency

- `GitDiffPanel` remains the only `RendererContextMenu` / discard-dialog host.
- The feature-local pure builder owns presentation only；repository and section scope remain in parent handlers.
- Multi Stage / Unstage call the scoped callback directly and refresh once only after success.
- Discard reuses the existing current-repository / explicit-repository confirmation flow.
- No backend command、Tauri payload、dependency、persistent state or cross-repository bulk behavior was added.
- Contract scope matches the real surfaces：single-repository flat/tree plus multi-repository grouped list.

## Validation Evidence

| Gate | Result |
|---|---|
| Focused Vitest | PASS — 3 files，98 tests |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm run check:large-files` | PASS — existing baseline report only |
| `npm run check:native-menu-usage` | PASS |
| `git diff --check` | PASS |
| Trellis task context validation | PASS |
| `openspec validate ... --strict --no-interactive` | PASS |

## Known Repository Baseline

- `npm run test` reaches an unrelated existing failure in `src/features/app/components/Sidebar.styles.test.ts`：the unchanged test expects `.fvp-tab.is-active::after`, while unchanged `src/styles/file-view-panel.css` does not contain that selector.
- `git diff --name-only HEAD -- src/features/app/components/Sidebar.styles.test.ts src/styles/file-view-panel.css` returns no paths，证明该 failure 不属于本 change。
- The focused Git Diff test surface and every gate required by task 3.1 pass.

## Non-Goals Preserved

- No History / Blame / repository-level commands were added to the file menu.
- No separate mutation-error UI or shared `RendererContextMenu` keyboard-focus redesign was introduced；existing runtime and accessibility behavior outside this right-click feature remains unchanged.
