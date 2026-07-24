## 任务清单

### 1. Worktree git status 事件驱动 + 门控兜底

- [x] 1.1 [P0][Depends: none][Input: `GitHistoryWorktreePanel.tsx` 现有 `refreshStatus` 与 `subscribeDetachedExternalFileChangeBatch` hub][Output: 按 workspaceId 过滤 + 1s 节流的 watcher 刷新，替换 3s setInterval][Verify: worktree 测试通过，外部改文件后事件触发刷新]
- [x] 1.2 [P0][Depends: 1.1][Input: `setVisibilityGatedInterval` 已存在][Output: 30s 门控慢速兜底，窗口隐藏时暂停][Verify: 手动切换浏览器可见性，确认隐藏期无 `getGitStatus` IPC]

### 2. Kanban scheduler next-due 对齐定时器

- [x] 2.1 [P0][Depends: none][Input: `useAppShellKanbanExecutionSection.ts` scheduler effect][Output: 固定 20s setInterval 改为 next-due 自续期 setTimeout][Verify: 到期 once/recurring 任务在准点触发，无任务时无唤醒]
- [x] 2.2 [P1][Depends: 2.1][Input: `updateTaskExecution` 写入逻辑][Output: 等值短路，避免相同 execution 状态反复产生 store 版本][Verify: kanban 相关测试通过，scheduler effect 不自触发死循环]

### 3. Engine task output snapshot visibility gate

- [x] 3.1 [P0][Depends: none][Input: `useEngineTaskOutputSnapshot.ts` running 轮询][Output: `setInterval` → `setVisibilityGatedInterval`][Verify: engine-task-output 测试通过，隐藏窗口后无 IPC]

### 4. Runtime dock Rust 差量 emit + 慢速兜底

- [x] 4.1 [P0][Depends: none][Input: `runtime/commands.rs`、`useGlobalRuntimeNoticeDock.ts`][Output: Rust 侧 `publish_runtime_pool_snapshot_if_changed` 与前端 `subscribeRuntimePoolChanged` hub][Verify: Rust `cargo check` 通过]
- [x] 4.2 [P0][Depends: 4.1][Input: `lib.rs` 15s reconcile 循环与 `mutate_runtime_pool`/`note_web_service_reconnected`][Output: 三处均调用发布函数][Verify: runtime dock 在 engine 启停后事件触发更新]
- [x] 4.3 [P0][Depends: 4.2][Input: `useGlobalRuntimeNoticeDock.ts` 5s 轮询][Output: 订阅事件 + `setVisibilityGatedInterval(60s)` 兜底][Verify: 无变化时无 `getRuntimePoolSnapshot` IPC]

### 5. 跨层验证与交付

- [x] 5.1 [P0][Depends: 1.2, 2.2, 3.1, 4.3][Input: 全部改动文件][Output: 格式化、typecheck、lint、相关测试通过][Verify: `npm run typecheck`、`npm run lint`、Vitest 相关模块全绿]
- [x] 5.2 [P0][Depends: 5.1][Input: Rust 改动][Output: `cargo check` 通过][Verify: `cargo check --manifest-path src-tauri/Cargo.toml`]
- [x] 5.3 [P1][Depends: 5.2][Input: OpenSpec artifacts][Output: proposal / design / tasks / verification 补全][Verify: `openspec validate reduce-client-polling-overhead --strict --no-interactive`]
- [ ] 5.4 [P1][Depends: 5.3][Input: 实机运行][Output: 四条路径手动 smoke evidence][Verify: worktree/kanban/output/dock 行为与验收标准一致] 保持 unchecked，待人工实机确认后关闭。

### 6. Review-Discovered Closure

- [ ] 6.1 [P1][Depends: review][Input: review 发现项][Output: 修复或记录 waiver][Verify: 二次 review 通过]
