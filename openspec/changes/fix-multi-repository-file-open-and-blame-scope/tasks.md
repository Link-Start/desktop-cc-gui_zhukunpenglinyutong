## 1. Repository-Aware File Open Contract

- [x] 1.1 [P0, depends: none] 扩展 `OpenFileOptions` 与 `resolveEditorOpenPath`，输入 optional `repositoryRoot`，输出正确 workspace-relative path；focused tests 覆盖 configured fallback、nested override 与 explicit workspace-root `""`。
- [x] 1.2 [P0, depends: 1.1] 将 `repositoryRoot + repo-relative path` 从 `GitMultiRepositoryChanges` 经 `GitDiffPanel`、`useLayoutNodes` 传到 shared editor open flow；interaction test 证明 row click 不再 noop。
- [x] 1.3 [P0, depends: 1.2] 增加两个 repository 同名 `pom.xml` 的回归测试，验证生成两个 distinct workspace tab paths，且 single-repository row open 不回退。

## 2. Multi-Repository Git Blame Scope

- [x] 2.1 [P0, depends: none] 将 aggregate `gitRepositories` 传入 main `FileViewPanel`，复用 `resolveFileGitScope` longest-prefix helper 输出 owner `repositoryRoot + path`。
- [x] 2.2 [P0, depends: 2.1] 调整 Blame eligibility fallback：inventory non-empty 时 no-owner 必须禁用；inventory empty/omitted 时保持 configured `gitRoot` compatibility。
- [x] 2.3 [P0, depends: 2.2] 增加 non-configured repository、nested longest-prefix、known no-owner 与 single-repository fallback tests，并断言 Blame IPC payload。

## 3. Analogous Contract Audit

- [x] 3.1 [P1, depends: 1.2, 2.2] 审计 modal preview、stage/unstage、commit selection、file tree decoration 与 file history 的 repository identity；输出为 focused assertions 或 code evidence，不新增无关 abstraction。
- [x] 3.2 [P1, depends: 3.1] 搜索 Git-domain noop handlers 与仅传 repo-relative path 的跨层 caller；发现同根因断链则补齐并测试，否则记录 no-additional-gap 结论。

## 4. Verification

- [x] 4.1 [P0, depends: 1.3, 2.3, 3.2] 运行 touched Vitest suites，覆盖 controller、layout wiring、multi-repository rows、FileViewPanel Blame 与 `fileGitScope`。
- [x] 4.2 [P0, depends: 4.1] 运行 `npm run typecheck`、`npm run lint` 与 `git diff --check`，不得引入新 warning/error。
- [x] 4.3 [P0, depends: 4.2] 运行 strict OpenSpec validation 和 `openspec-verify-change`，将实际命令与 audit 结论写入 verification evidence。
