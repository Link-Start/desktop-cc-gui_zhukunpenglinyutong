## 1. Scoped branch orchestration

- [x] 1.1 [P0, depends: none] Extend `useGitBranches.checkoutBranch(name, repositoryRootOverride?)`; input is optional explicit scope, output preserves existing Promise/error semantics; verify with hook tests and typecheck.
- [x] 1.2 [P0, depends: 1.1] Add sequential best-effort Update All / Checkout All handlers in `useAppShellGitWorkspaceOpsSection`; input is repository summaries plus optional target branch, output is structured success/failure/skipped summary; verify exact ordered scoped calls, dedupe, partial failure, and single aggregate refresh.

## 2. Composer command center UI

- [x] 2.1 [P0, depends: 1.2] Thread typed global action callbacks through `layoutNodesTypes` and `useLayoutNodes`; output is a stable `ComposerBranchControl` contract; verify TypeScript compile and runtime prop-chain checks.
- [x] 2.2 [P0, depends: 2.1] Add the multi-repository root action row, checkout target input step, pending state, and deterministic result feedback to `ComposerBranchBadge`; verify keyboard-accessible controls and unchanged single-repository rendering.
- [x] 2.3 [P1, depends: 2.2] Add localized copy to every `src/i18n/locales/*/git.ts` module；verify no hardcoded user-facing copy and locale type consistency.

## 3. Verification and closure

- [x] 3.1 [P0, depends: 2.2] Add focused component and AppShell hook regression tests for visibility, sequential ordering, explicit empty-root scope, skip, partial failure, pending dedupe, and feedback.
- [x] 3.2 [P0, depends: 2.3, 3.1] Run focused Vitest, `npm run lint`, `npm run typecheck`, runtime contracts, and `openspec validate add-multi-repository-global-git-actions --strict --no-interactive`; output is recorded passing evidence or explicit pre-existing blockers.
- [x] 3.3 [P1, depends: 3.2] Perform cross-layer/reuse review, update executable Trellis code-spec if needed, and leave manual app acceptance unchecked for user validation; do not commit.

## 4. Acceptance correction: common branch discovery

- [x] 4.1 [P0, depends: 2.2] Add scoped branch discovery and exact local/remote candidate aggregation across repositories.
- [x] 4.2 [P0, depends: 4.1] Replace the free-form global checkout step with loading, searchable common local/remote branch groups and keyboard-selectable targets.
- [x] 4.3 [P0, depends: 4.2] Add focused tests for aggregation, explicit empty-root scope, remote target selection, loading warning, empty results, and existing batch checkout behavior.
- [x] 4.4 [P0, depends: 4.3] Update Trellis executable contract and run focused Vitest, lint, typecheck, runtime contracts, and strict OpenSpec validation; leave manual acceptance pending and do not commit.

## 5. Acceptance correction: partial branch coverage

- [x] 5.1 [P0, depends: 4.1] Replace all-repository intersection with exact branch coverage groups that require at least two eligible repositories.
- [x] 5.2 [P0, depends: 5.1] Show eligible/total counts and repository names; preserve useful groups when another repository branch-list fails.
- [x] 5.3 [P0, depends: 5.1] Scope Checkout All to the selected group's eligible repository roots and report non-members as skipped.
- [x] 5.4 [P0, depends: 5.2, 5.3] Update focused tests and executable Trellis contract, rerun gates, and leave manual acceptance pending without commit/archive.

## 6. Acceptance correction: repository icon identity colors

- [x] 6.1 [P1, depends: 2.2] Assign deterministic, distinct theme-safe icon color slots to repository rows without changing Git status semantics.
- [x] 6.2 [P1, depends: 6.1] Add a focused component regression test for stable per-repository color differentiation.
- [x] 6.3 [P1, depends: 6.2] Update the executable Trellis contract and rerun focused Vitest, lint, typecheck, runtime contracts, and strict OpenSpec validation; leave manual acceptance pending without commit/archive.
