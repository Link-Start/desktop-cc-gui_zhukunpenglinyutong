## 1. Shared contracts

- [x] 1.1 [P0][Depends: none][Input: two AI commit flows][Output: shared generation controller][Verify: controller unit tests]
- [x] 1.2 [P1][Depends: none][Input: diff surface inputs][Output: shared presentation model][Verify: surface focused tests]

## 2. Capability modularization

- [x] 2.1 [P0][Depends: 1.1][Input: `GitDiffPanel.tsx`][Output: capability-owned module below gate][Verify: GitDiffPanel tests]
- [x] 2.2 [P0][Depends: none][Input: `FileViewPanel.tsx`][Output: capability-owned module below gate][Verify: FileViewPanel focused tests]
- [x] 2.3 [P0][Depends: 2.1,2.2][Input: two oversized test files][Output: split suites below gate][Verify: all moved suites pass]

## 3. Review and closure

- [x] 3.1 [P0][Depends: 2.3][Input: changed files][Output: incremental evidence][Verify: typecheck + touched lint + targeted gate]
- [x] 3.2 [P0][Depends: 3.1][Input: batch diff][Output: review findings resolved][Verify: `git diff --check`]
- [x] 3.3 [P1][Depends: 3.2][Input: artifacts][Output: synced/archived change][Verify: strict change validation]
