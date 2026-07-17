## 1. Cross-layer Git Blame Contract

- [x] 1.1 [P0, 依赖: 无] 输入 `git2::Repository`、repository-relative path 与 optional `repositoryRoot`，输出 camelCase `GitFileBlameResponse/GitBlameHunk` DTO 和 blocking blame helper；验证 Rust happy/error/path tests 通过。
- [x] 1.2 [P0, 依赖: 1.1] 输入 Desktop workspace scope，输出 `get_git_file_blame` Tauri command、registry 与 remote forwarding；验证 command registry/forwarding matrix tests 通过。
- [x] 1.3 [P0, 依赖: 1.1] 输入 daemon RPC payload，输出与 Desktop 等价的 daemon dispatch/implementation；验证 daemon mapping 与 nested repository tests 通过。
- [x] 1.4 [P0, 依赖: 1.2,1.3] 输入 backend camelCase response，输出 `src/types/git.ts` type 与 `src/services/tauri/git.ts` wrapper；验证 `src/services/tauri.test.ts` payload mapping 通过。

## 2. Frontend Orchestration

- [x] 2.1 [P0, 依赖: 1.4] 输入 active workspace file、repository scope、enabled/dirty/save epoch，输出 feature-local `useFileGitBlame` disabled/loading/ready/stale/error state、latest-only cancellation 与 bounded session cache；验证 disabled zero-call、file switch stale drop、dirty/save refresh tests 通过。
- [x] 2.2 [P0, 依赖: 2.1] 输入 hunk response，输出 sorted validation、binary-search visible-line lookup 与 compact/full metadata formatters；验证 pure utility edge tests 通过。

## 3. CodeMirror and File View UX

- [x] 3.1 [P0, 依赖: 2.2] 输入 enabled/state/hunks，输出 lazy `FileCodeMirrorEditorImpl` 内 stable Compartment、StateEffect、viewport blame gutter 与单个 current-line inline widget；验证 disabled no-gutter、payload update no-remount、visible marker tests 通过。
- [x] 3.2 [P0, 依赖: 3.1] 输入 file view edit mode，输出 topbar toggle、gutter-only context menu、loading/stale/error affordance 和不扩宽 gutter 的 current-line detail；验证 native content context menu 保留、a11y 与 interaction tests 通过。
- [x] 3.3 [P1, 依赖: 3.2] 输入新增 copy/state，输出中文/英文 i18n 与 theme-aware file-view CSS；验证 locale/type/style focused checks 通过。

## 4. Performance and Completion Gates

- [x] 4.1 [P0, 依赖: 3.2] 输入 typing/cursor/hover/scroll/tab-switch 场景，输出 zero extra blame IPC、first viewport independent、stale response 与 save-once regression tests；验证 focused Vitest suites 通过。
- [x] 4.2 [P0, 依赖: 1.4,4.1] 输入全部跨层变更，输出 runtime contracts、typecheck、focused Rust/TS tests 与 OpenSpec strict validation 结果；验证所有命令通过或显式记录既有失败。

## Verification Evidence（2026-07-17）

- `npm run typecheck -- --pretty false`：通过。
- `npm run lint`：0 errors；另一个 active change 的 `FileHistoryView.tsx` 存在 1 个既有 `react-hooks/exhaustive-deps` warning。
- focused Vitest：file view、typing latency、lazy race、CodeMirror gutter/inline detail、hook、utility、style 与 Tauri bridge 共 228 tests 通过；包含同路径 snapshot/render token 变化时旧 blame response 丢弃、save-once refresh，以及 current-line detail 不扩宽 gutter 的回归。
- `npm run check:runtime-contracts && npm run check:file-interaction-evidence`：通过。
- Rust：blame helper、nested repository scope、remote forwarding matrix 与 daemon payload/response parity contract tests 通过；daemon binary test target 编译通过。
- `openspec validate add-file-view-git-blame --strict --no-interactive`：通过。
- 全仓 `npm run test`：在第 19/205 batch 被既有 `Sidebar.styles.test.ts` 阻塞；该测试要求 `.fvp-tab.is-active::after`，与当前 `file-view-panel-visual-contract.test.ts` 的“active tab 不绘制 underline”契约冲突，本变更未修改相关 selector/test。
- 全仓 `cargo fmt --check`：被 `browser_agent/mod.rs`、`browser_agent/toolbar.rs`、`client_storage.rs`、`menu.rs` 的既有格式差异阻塞；本变更触及的 `git_utils.rs` 已单文件 `rustfmt`。
