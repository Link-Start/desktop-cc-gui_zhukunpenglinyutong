## 1. Shared Git identity contract

- [x] 1.1 [P0, depends: none] 输入 libgit2 staged/workdir `StatusEntry`，实现 shared path identity resolver；输出 destination `path`、optional source `oldPath`，并用 Rust unit test 覆盖 staged rename、unstaged rename 与 deleted fallback。
- [x] 1.2 [P0, depends: 1.1] 输入现有 Desktop/daemon `get_git_status` loop，接入 shared resolver 与 additive `GitFileStatus.oldPath`；通过 Rust compile/tests 验证两端 payload parity。
- [x] 1.3 [P0, depends: 1.1] 输入 rename mutation target，将 old/new path expansion 下沉为 shared helper并接入 Desktop/daemon stage/unstage/discard；用 rename regression test 验证两端不会遗漏任一侧。

## 2. Frontend activation behavior

- [x] 2.1 [P0, depends: 1.2] 输入 additive status payload，扩展 shared TypeScript type、canonical copy 与 polling equality；用 Vitest 验证 `oldPath` 保留和 identity 变化可触发更新。
- [x] 2.2 [P0, depends: 2.1] 输入 single-repository `R/D` rows，使 rename ordinary open 使用 destination、deleted ordinary activation 复用 read-only modal；用 `GitDiffPanel.test.tsx` 验证 open/preview callback 互斥。
- [x] 2.3 [P0, depends: 2.1] 输入 multi-repository `R/D` rows，使 click/Enter 保留 `repositoryRoot + destination`，deleted 路由 scoped preview；用 `GitMultiRepositoryChanges.test.tsx` 覆盖 nested repo 与同名路径隔离。

## 3. Verification

- [x] 3.1 [P0, depends: 1.2, 1.3, 2.2, 2.3] 运行 focused Rust tests 与 Git Vitest suites；输出所有新增回归用例通过结果。
- [x] 3.2 [P1, depends: 3.1] 运行 `npm run typecheck`、`npm run check:runtime-contracts` 与 strict OpenSpec validation；输出 gate 结果并明确区分任何 pre-existing failure。
- [x] 3.3 [P1, depends: 3.2] 检查 `git diff --name-only`，确认只包含本 change artifacts、Git 相关 code/tests，且未修改他人的 README、main specs 或 archive work。

## 4. Review remediation

- [x] 4.1 [P0, depends: 1.1] 输入 raw libgit2 working-tree diff，抽取 shared rename detection/alias pathspec helper并接入 Desktop/daemon diff、stats、full-diff；用真实 repository test 覆盖 unchanged/modified rename、单一 `R` projection 与准确 stats。
- [x] 4.2 [P0, depends: 1.3] 让 rename mutation resolver 接收 `GitStatusLayer` intent；stage/discard 选择 Workdir、unstage 选择 Index，并用 `HEAD a → Index b → Workdir c` regression test 覆盖 source/destination 两侧输入。
- [x] 4.3 [P0, depends: 2.2] single-repository mouse click 与 Enter/Space 复用 `(path, section)` activation callback；用 `GitDiffPanel.test.tsx` 覆盖 rename destination 与 deleted read-only preview parity。
- [x] 4.4 [P0, depends: 4.1, 4.2, 4.3] 运行 focused Rust/Vitest、daemon check、typecheck、lint、runtime contracts 与 strict OpenSpec validation；最后执行 change-scoped diff audit，确认未触碰 README、main specs、archive 或其他 change。
