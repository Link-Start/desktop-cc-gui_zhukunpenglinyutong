## 验证结果

### 自动化验证

| 命令 | 状态 | 备注 |
|---|---|---|
| `npm run typecheck` | ✅ 通过 | 全仓 TypeScript 无错误 |
| `npm run lint`（受影响文件） | ✅ 通过 | eslint 无输出 |
| `npx vitest run src/features/kanban` | ✅ 73 tests passed | 含 scheduling 与 storage |
| `npx vitest run src/features/notifications src/features/engine-task-output src/features/git-history` | ✅ 224 tests passed | 含 dock / output / git-history-panel |
| `cargo check --manifest-path src-tauri/Cargo.toml` | ✅ 通过 | 仅既有 warnings，无新增错误 |
| `cargo test --manifest-path src-tauri/Cargo.toml runtime::` | ⚠️ 61 passed, 2 failed | 失败项为基线即存在的进程终止 flake，与本次无关（见下方说明） |
| `openspec validate reduce-client-polling-overhead --strict --no-interactive` | ⏳ 待运行 | artifact 刚创建，待用户环境执行 |

### Rust 测试失败说明

失败测试：
- `runtime::tests::replace_workspace_session_with_source_marks_old_session_shutdown_source`
- `runtime::tests::replacement_waiter_does_not_swap_in_a_third_runtime`

通过 `git stash` 还原本次 Rust 改动后复跑，两测试仍失败，报错为「failed to terminate process group ... No such process (os error 3)」。属于测试环境进程被异步回收导致的 flake，非本次引入。

### 手动验收清单（待实机确认）

- [ ] Worktree：外部终端修改文件 → ~1s 内刷新；外部 `git add` → ≤30s 内 staged 区收敛；窗口隐藏后无 `getGitStatus` IPC。
- [ ] Kanban：建 1 分钟后到期的 once 任务 → 准点触发；无任何 schedule 任务时无周期 tick；recurring 任务两轮均准点。
- [ ] Task output：running 任务打开输出面板 → 隐藏窗口 30s 期间无 `readEngineTaskOutputArtifact`；切回立即刷新。
- [ ] Runtime dock：手动启停 engine → dock 行 ≤1s 更新；静置无变化时无 `getRuntimePoolSnapshot` IPC。

### 已知限制 / Waiver

- `detached-external-file-change` 事件不保证覆盖 `.git/index` 修改，因此 worktree 保留 30s 门控兜底。
- Rust signature 使用 `format!("{:?}...", ...)` 对枚举/Option 字段做稳定字符串化；频率为 15s 一次，行数个位数，开销可忽略。
