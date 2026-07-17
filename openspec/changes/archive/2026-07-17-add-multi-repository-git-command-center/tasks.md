## 1. Contract 与 Backend Read Model

- [x] 1.1 [P0] 定义 `GitRepositorySummary` frontend/Rust payload 与 normalization；输入为 workspace-relative repository identity，输出为 slim summary；依赖：无；验证：type tests + serde/normalization assertions。
- [x] 1.2 [P0] 实现跨平台 repository root validator 与 aggregate discovery/summary helper；输入为 workspace root/depth，输出为 root+nested summaries/row-local error；依赖：1.1；验证：Rust tests 覆盖 root、`a/b`、`a\\b`、worktree `.git` file、absolute/traversal/non-repo。
- [x] 1.3 [P0] 新增 `list_git_repository_summaries` Tauri command 和 remote daemon parity；输入为 `workspaceId/depth`，输出统一 summary array；依赖：1.2；验证：forward payload test、daemon dispatch test、focused cargo test。

## 2. Repository-scoped Branch Contract

- [x] 2.1 [P0] 为 branch list/checkout/create/update 增加 optional `repositoryRoot`，保留 omitted legacy behavior；依赖：1.2；验证：Rust sibling repository isolation tests。
- [x] 2.2 [P0] 同步 `src/services/tauri/git.ts`、shared types、desktop forwarding 与 daemon dispatch 参数；依赖：2.1；验证：runtime contract checks + frontend service mapping tests。
- [x] 2.3 [P1] 扩展 branch response normalizer/hook，保留 local/remote/current/upstream/ahead/behind 并支持 scoped load/mutation/stale rejection；依赖：2.2；验证：focused hook/utility Vitest。

## 3. Shared Repository State 与文件树

- [x] 3.1 [P0] 新增 feature-local repository controller，聚合 load/dedupe/stale rejection、mutation refresh 与 >=30s fallback；依赖：1.3；验证：fake timers + workspace switch tests。
- [x] 3.2 [P0] 将 stable repository summaries 接入 AppShell/layout/FileTreePanel，不在 root render chain 引入高频 state；依赖：3.1；验证：render identity/polling contract tests。
- [x] 3.3 [P0] 为 root label 与 exact nested repository folder row 增加 repository icon、branch、sync/dirty/detached/error decoration，并保持普通 `folderGitStatusMap` 语义；依赖：3.2；验证：FileTreePanel focused tests + narrow row DOM assertions。

## 4. Adaptive Git Command Center

- [x] 4.1 [P0] 将 `ComposerBranchBadge` 拆分为可测试的 single/multi repository command center view model 与 components，确保每个文件 <3000 行；依赖：2.3、3.1；验证：single/multi repository component tests。
- [x] 4.2 [P0] 实现 repository list、back/search、recent/local/remote hierarchy、current/upstream/ahead/behind、checkout/create/update；依赖：4.1；验证：keyboard/a11y/error/dirty checkout tests。
- [x] 4.3 [P0] 接入 Commit/Push 全量 action：await existing Git root selection，打开既有 Git Diff/History workflow 与对应 action，不复制 write logic；依赖：4.1；验证：target repository navigation + one-shot action tests。
- [x] 4.4 [P1] 补齐 theme-token styles 与所有 locale keys，兼容 narrow panel 和 macOS/Windows titlebar interaction；依赖：4.2、4.3；验证：style contract + i18n key coverage tests。

## 5. 闭环验证与规范同步

- [x] 5.1 [P0] 执行 cross-layer/reuse/import/same-layer review 并修复遗漏；依赖：1-4；验证：`rg` callers、payload mapping、desktop/daemon capability matrix。
- [x] 5.2 [P0] 执行 focused Vitest、typecheck、lint、runtime contracts、large-file gate 与 focused/full feasible cargo tests；依赖：5.1；验证：所有命令退出码为 0，所有源码文件 <=3000 行。
- [x] 5.3 [P0] 执行 `openspec validate add-multi-repository-git-command-center --type change --strict` 与 `openspec-verify-change`，记录未执行的人工 app QA；依赖：5.2；验证：无 CRITICAL/WARNING artifact drift。

## 6. Incremental UX Closure: Update Feedback 与 Repository Context Menu

- [x] 6.1 [P0] 修复 compact Update action：透传 structured result、增加 keyed loading/duplicate guard、显示 success/no-op/blocked/error feedback；依赖：4.2；验证：pending 与各 result component tests。
- [x] 6.2 [P0] 将 branch sections 明确为 Recent/Local/Remote，并保持 scoped grouping/search/current/upstream metadata；依赖：6.1；验证：heading 与 branch visibility tests。
- [x] 6.3 [P0] 为 exact repository folder 增加 typed Git submenu，普通 folder 不显示；依赖：3.3；验证：FileTreePanel context-menu DOM tests。
- [x] 6.4 [P0] 接入 repository-scoped Hybrid actions：先 await root selection，安全 action 直接执行并反馈，高风险/参数化 action 复用 Git Diff/History workflow；依赖：6.3；验证：repository target isolation + one-shot navigation tests。
- [x] 6.5 [P0] 补齐 locale、cross-layer/reuse audit 与 focused/full gates；依赖：6.1-6.4；验证：focused Vitest、typecheck、lint、build、runtime contracts、large-file gate、focused Rust tests、OpenSpec strict verify 全绿；全量 Vitest 覆盖 793 个文件并记录两个与本 change 无 diff 关联、可独立复现的 baseline failures；未执行 commit/archive/sync。

## 7. Incremental Interaction Reliability Closure

- [x] 7.1 [P0] repository switch row 增加 keyed loading、duplicate guard、await/error settlement；依赖：4.2；验证：pending/duplicate/failure component tests。
- [x] 7.2 [P0] Recent/Local/Remote sections 改为独立折叠且默认关闭，搜索临时展开匹配 section；依赖：7.1；验证：default collapsed/search reveal/toggle tests。
- [x] 7.3 [P0] repository Git submenu 精简为确认的 11 个 actions，并修正 flyout 贴近 trigger 的自适应 viewport placement；依赖：6.3；验证：menu item/left-right clamp unit tests。
- [x] 7.4 [P0] standalone root repository 的 root label 增加右键 Git submenu，复用 `repositoryRoot=""` action builder；依赖：7.3；验证：root/non-root repository context-menu tests。
- [x] 7.5 [P0] 修复 nested repository diff preview 的 repository/path scope、stale rejection 与 loading/error settlement；依赖：6.4；验证：nested path + Windows separator + failure/stale tests。
- [x] 7.6 [P0] 执行 cross-layer/reuse audit、focused/full feasible gates、OpenSpec strict verify 与 3000-line gate；依赖：7.1-7.5；验证：Vitest、typecheck、lint、build、runtime contracts、large-file gate、OpenSpec validation；不执行 commit/archive/sync。
