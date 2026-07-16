## 1. Contract 与 scope foundation

- [x] 1.1 [P0, 无依赖] 扩展 frontend `getGitCommitHistory` options，输入 optional repository-relative `path`，输出保持 `GitHistoryResponse`；用 service mapping test 验证 omitted/path payload。
- [x] 1.2 [P0, 无依赖] 新增 pure file-to-repository scope resolver，输入 workspace-relative path + `GitRepositorySummary[]`，输出 longest-match `repositoryRoot` + repository-relative path；覆盖 root/nested/Windows/escape/no-match tests。

## 2. Desktop 与 daemon file history

- [x] 2.1 [P0, 依赖 1.1] 在 shared Git layer 实现 validated `git log --follow` OID query，并用 `git2` 映射现有 commit model；验证 normal/root/rename/invalid path fixture。
- [x] 2.2 [P0, 依赖 2.1] 扩展 Desktop `get_git_commit_history` optional path、snapshot identity 与 remote forwarding payload；验证未传 path regression 和 snapshot mismatch。
- [x] 2.3 [P0, 依赖 2.1] 扩展 daemon dispatch 与 daemon Git history optional path，确保 repositoryRoot/path parity；运行 focused daemon/backend tests。

## 3. File History UI

- [x] 3.1 [P0, 依赖 1.1/2.2] 新增独立 `FileHistoryView`，输入 `FileHistoryTarget`，输出 virtualized commit list、selected file diff、分页与 loading/error/empty/retry/close 状态。
- [x] 3.2 [P0, 依赖 3.1] 为 history/diff request 增加 generation guard；用 component tests 验证 rapid file/commit switch 丢弃迟到 response。
- [x] 3.3 [P1, 依赖 3.1] 新增 File History 独立 CSS shard、feature style loading 与 i18n copy；验证 dark/light token 与窄 viewport 基础布局。

## 4. Entry 与 AppShell integration

- [x] 4.1 [P0, 依赖 1.2/3.1] 扩展 `FileTreePanel` optional `onOpenFileHistory`，只为 supported repository file 添加 Git submenu item；用 menu tests 验证 file/root/nested/unsupported host。
- [x] 4.2 [P0, 依赖 4.1] 在 main AppShell 接入 nullable `FileHistoryTarget`、open/close handler 与互斥 surface routing；验证打开目标、切换目标和关闭返回 workspace。
- [x] 4.3 [P1, 依赖 4.2] 确认 detached explorer 不传 callback 且不显示 dead entry，记录第一版 scope evidence。

## 5. Verification 与 spec closure

- [x] 5.1 [P0, 依赖 2.x/3.x/4.x] 运行 focused Vitest、focused Cargo tests、`npm run typecheck` 与 `npm run check:runtime-contracts`，记录通过项和环境阻塞。
- [x] 5.2 [P0, 依赖 5.1] 运行 `openspec validate add-file-history-view --strict --no-interactive`，核对 code/spec/task parity，并更新所有已完成 checkbox。
- [x] 5.3 [P1, 依赖 5.2] 人工 smoke：root/nested repository 文件右键、rename history、commit switch、diff style、close/back；用户已明确验收通过。

## 6. Adaptive layout 与 aligned compare 增量

- [x] 6.1 [P0, 依赖 3.1] 将 selected text diff 切换为 shared `WorkspaceReadOnlyDiffCompare`，保持历史内容只读并覆盖 previous/source aligned rendering test。
- [x] 6.2 [P0, 依赖 6.1] 用 named CSS container、bounded commit rail 和 narrow stacked layout 让 workspace 消费实际可用宽度；覆盖 CSS contract test。
- [x] 6.3 [P0, 依赖 6.1/6.2] 运行 focused Vitest、lint、typecheck、runtime contracts 与 OpenSpec strict validation，并更新 verification evidence。

## 7. Read-only Diff decoration 修复

- [x] 7.1 [P0, 依赖 6.1] 分离 `editable=false` 与 plain-text fallback gate，使 normal read-only compare 继续渲染 CodeMirror，并允许 difference navigation programmatic scroll。
- [x] 7.2 [P0, 依赖 7.1] 为 previous/source columns 注入 deletion/addition semantic tone，新增 scoped red/green line decoration styles，保留 error/truncated fallback。
- [x] 7.3 [P0, 依赖 7.1/7.2] 补充 render gate、tone、markers 与 no-mutation tests，运行 focused Vitest、lint、typecheck、runtime contracts 和 strict validation，更新 verification evidence。

## 8. Review closure：rename identity、line coordinates 与 binary parity

- [x] 8.1 [P0, 依赖 2.1/3.1] 让 path-scoped history 返回 optional commit-time `filePath`，File History 使用 exact historical path 请求 selected diff，并禁止 unrelated first-entry fallback；覆盖 rename fixture 与 component mapping tests。
- [x] 8.2 [P1, 依赖 7.1] 复用 `parseDiff()` 的 `oldLine/newLine` 为 historical CodeMirror 注入 optional gutter labels，覆盖 non-1/multi-hunk coordinates，禁止 padding/full-context workaround。
- [x] 8.3 [P1, 依赖 2.3/3.1] 复用 shared image helpers 对齐 Desktop/daemon image payload，并为 non-image binary 显示 explicit state；覆盖 Rust parity 与 frontend binary/image tests。
- [x] 8.4 [P0, 依赖 8.1/8.2/8.3] 运行 focused Vitest/Cargo、lint、typecheck、runtime contracts、diff check 与 strict OpenSpec validation；同步 Trellis contract 和 verification evidence。
