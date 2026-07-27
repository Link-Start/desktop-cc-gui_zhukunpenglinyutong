## 1. AI Commit Message 交互恢复

- [x] 1.1 [P0][Depends: none][Input: `GitDiffPanel.tsx` / `GitHistoryWorktreePanel.tsx` 当前 direct-generate click path][Output: 主按钮始终打开 engine menu，保留 menu 内 last config 与 engine → language 流程][Verify: 两个 component tests 断言存在 persisted config 时左键仍显示 engine menu 且不直接 generate]
- [x] 1.2 [P1][Depends: 1.1][Input: `commitMessageMenuConfig.ts` 与两个 engine menu][Output: `readExecutableCommitMessageConfig` 仅服务可见 last-config quick option，两个 menu 统一拒绝 disabled/retired engine][Verify: tests 断言 invalid last config disabled 且 typecheck 通过]

## 2. Prompt Enhancer Workspace 隔离

- [x] 2.1 [P0][Depends: none][Input: Prompt Enhancer module LRU / request generation][Output: cache key 纳入 `workspaceId`，workspace 变化 invalidates in-flight request][Verify: hook test 覆盖相同 prompt 跨 workspace 不命中 cache、旧 request 不写回]

## 3. Managed Command Runtime Safety

- [x] 3.1 [P0][Depends: none][Input: `write_managed_command` 的 `exists + fs::write`][Output: `create_new` exclusive create、duplicate error mapping、write failure partial cleanup][Verify: Rust 并发同名 create test 恰好一个成功且文件内容属于 winner]
- [x] 3.2 [P0][Depends: none][Input: commands watcher frontend effect + Rust registry][Output: cleanup await start settle；backend registry 使用 per-scope lease count 且首次 check/insert 同一 critical section][Verify: hook pending-start unmount test + Rust duplicate lease acquire/release test]

## 4. 验证与收口

- [x] 4.1 [P0][Depends: 1.1, 1.2, 2.1, 3.1, 3.2][Input: touched frontend files][Output: frontend regression gates 通过][Verify: focused Vitest、`npm run typecheck`、targeted ESLint]
- [x] 4.2 [P0][Depends: 3.1, 3.2][Input: touched Rust files][Output: Rust regression gates 通过][Verify: targeted `cargo test` + `cargo fmt --check`]
- [x] 4.3 [P1][Depends: 4.1, 4.2][Input: OpenSpec artifacts][Output: artifacts 与实现一致、tasks 勾选完成][Verify: `openspec validate harden-composer-and-ai-commit-controls --strict --no-interactive`]
