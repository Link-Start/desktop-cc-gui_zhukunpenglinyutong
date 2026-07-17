## 1. Callback Contract（P0，无依赖）

- [x] 1.1 输入：现有 AppShell/layout/Git panel props；输出：贯穿各层的 `repositoryRoot + path` revert callback；验证：`rg` 确认每层 forwarding 且 `npm run typecheck` 通过
- [x] 1.2 输入：现有 `revertGitFile` service；输出：AppShell scoped handler 使用 active workspace id 与 explicit repository root；验证：focused test 或 typecheck 覆盖调用签名

## 2. Discard Interaction（P0，依赖 1）

- [x] 2.1 输入：multi-repository status groups；输出：只在 unstaged `DiffFileRow` 显示 shared discard action；验证：component test 断言 unstaged 可见、staged 不可见
- [x] 2.2 输入：single/multi discard requests；输出：discriminated dialog target、cancel no-op、confirm scoped mutation 与成功后 refresh；验证：interaction tests 覆盖 confirm/cancel

## 3. Repository Isolation Tests（P0，依赖 2）

- [x] 3.1 输入：两个 repository 的同名 relative path；输出：目标 repository identity 保持隔离；验证：Vitest 断言 callback 精确收到被点击 group 的 `repositoryRoot + path`

## 4. Quality Gates（P1，依赖 1-3）

- [x] 4.1 输入：全部实现与测试；输出：focused Vitest、typecheck、lint 通过；验证：保存命令结果
- [x] 4.2 输入：OpenSpec artifacts 与 dirty worktree；输出：strict validation 通过且 diff 仅含本变更语义；验证：`openspec validate --all --strict --no-interactive` 与 `git diff` 审计
