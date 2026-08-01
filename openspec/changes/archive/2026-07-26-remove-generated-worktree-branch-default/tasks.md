## 1. Explicit Branch Input

- [x] 1.1 [P0, depends: none] 输入 `useWorktreePrompt.openPrompt` 随机 branch default；输出空 branch initial state，保留现有 validation/payload；验证 hook focused tests
- [x] 1.2 [P0, depends: 1.1] 输入 Worktree dialog 既有 submit guard；输出 empty/open/reopen/valid branch regression coverage；验证 hook 与 component focused tests

## 2. Regression Verification

- [x] 2.1 [P1, depends: 1.1, 1.2] 输入 touched files 与 OpenSpec artifacts；输出 targeted ESLint、TypeScript typecheck、strict OpenSpec validation 结果
