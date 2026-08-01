## 1. Repository-scoped inline diff

- [x] 1.1 [P0][depends:none][input:multi-repository inline preview callback chain][output:`repositoryRoot + path` threaded through `GitMultiRepositoryChanges`、`GitDiffPanel`、layout/AppShell selection contracts][verify:TypeScript signatures and component forwarding regression]
- [x] 1.2 [P0][depends:1.1][input:selected local diff repository scope][output:on-demand `getGitDiffs(workspaceId, repositoryRoot)` state with cancellation, error and reset semantics][verify:controller focused tests for success/error/stale workspace/clear scope]
- [x] 1.3 [P0][depends:1.2][input:scoped `GitFileDiff[]`][output:canonical viewer diffs selected by existing center diff path][verify:same-relative-path repositories render only owning scope]

## 2. Multi-repository section actions

- [x] 2.1 [P0][depends:none][input:unstaged repository group paths][output:section discard-all forwards exact `repositoryRoot + paths`; staged group remains without discard][verify:`GitMultiRepositoryChanges` focused test]
- [x] 2.2 [P0][depends:2.1][input:repository-scoped batch discard][output:existing explicit-repository confirmation target, sequential revert and one aggregate refresh][verify:Git panel confirmation cancel/success/submitting tests]

## 3. Layout and command header presentation

- [x] 3.1 [P1][depends:none][input:`centerMode === "diff"`][output:bottom Composer hidden while other center modes retain current placement][verify:DesktopLayout/layout focused regression]
- [x] 3.2 [P1][depends:none][input:multi-repository root Update All / Checkout All actions][output:compact icon-only accessible buttons inside command header, unchanged handlers/pending state][verify:`ComposerBranchBadge` role/header/icon/click regressions]
- [x] 3.3 [P1][depends:3.2][input:header action CSS][output:24px transparent controls with visible state through color and disabled opacity][verify:targeted visual/manual inspection and selector sentinel]

## 4. Verification and closure

- [x] 4.1 [P0][depends:1.3,2.2,3.3][input:changed component/controller/layout tests][output:focused automated evidence][verify:run affected Vitest suites and record exact results]
- [x] 4.2 [P0][depends:4.1][input:all changed TypeScript/CSS][output:quality gate evidence][verify:`npm run typecheck`, targeted lint and `git diff --check` pass]
- [x] 4.3 [P0][depends:4.2][input:proposal/design/tasks/spec deltas][output:valid OpenSpec change][verify:`openspec validate fix-multi-repository-git-inline-diff-scope --strict --no-interactive` passes]
- [x] 4.4 [P1][depends:4.3][input:running desktop app with nested repositories][output:manual acceptance for same-path inline diff, discard confirmation, diff layout and branch header actions][verify:user confirms behavior before sync/archive]

## Verification Record

- Focused Vitest：4 files / 82 tests passed。
- TypeScript：`npm run typecheck` passed。
- ESLint：`npm run lint` passed。
- Diff hygiene：`git diff --check` passed。
- OpenSpec：strict validation passed。
- Manual acceptance：用户确认通过（2026-07-23）。
