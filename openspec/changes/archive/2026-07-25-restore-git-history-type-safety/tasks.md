## 1. Contract foundation

- [x] 1.1 [P0][Depends: none][Input: current Impl scope object][Output: shared typed scope contract][Verify: consumer signatures reject unknown fields]
- [x] 1.2 [P0][Depends: 1.1][Input: 494 stripped diagnostics][Output: diagnostics grouped by consumer and root cause][Verify: reproducible in-memory TypeScript check]

## 2. Consumer migration

- [x] 2.1 [P0][Depends: 1.1][Input: `useGitHistoryPanelInteractions.tsx`][Output: typed hook with no file suppression][Verify: typecheck + interaction tests]
- [x] 2.2 [P0][Depends: 1.1][Input: `GitHistoryPanelDialogs.tsx`][Output: typed dialog renderer with no dead scope fields][Verify: typecheck + dialog tests]
- [x] 2.3 [P0][Depends: 2.2][Input: `GitHistoryPanelView.tsx`][Output: typed view renderer][Verify: typecheck + panel render tests]
- [x] 2.4 [P0][Depends: 2.1,2.3][Input: `GitHistoryPanelImpl.tsx`][Output: typed root and valid cleanup][Verify: zero target diagnostics]

## 3. Review and closure

- [x] 3.1 [P0][Depends: 2.4][Input: changed Git History files][Output: focused regression evidence][Verify: Vitest + typecheck + touched lint]
- [x] 3.2 [P0][Depends: 3.1][Input: batch diff][Output: review findings resolved][Verify: symbol sentinels + `git diff --check`]
- [x] 3.3 [P1][Depends: 3.2][Input: OpenSpec artifacts][Output: synced status and completed checklist][Verify: strict OpenSpec validation]
