## 设计概要

### 1. Worktree git status：事件 + 门控慢速兜底

- **输入**：`GitHistoryWorktreePanel` 挂载时调用 `refreshStatus()`，原 `useEffect` 启动 `setInterval(3000)`。
- **输出**：
  - 订阅 `subscribeDetachedExternalFileChangeBatch`。
  - 批次中只要存在本 `workspaceId` 的事件，就进入 1s 节流：即时刷新或 trailing 刷新。
  - 兜底使用 `setVisibilityGatedInterval(refreshStatus, 30_000)`；窗口隐藏时暂停，恢复可见时立即补一次 tick。
- **一致性**：watcher 漏过的 `.git/index` 变更由 30s 兜底收敛；用户操作后仍通过 `handleMutation` 主动刷新。

### 2. Kanban scheduler：next-due 对齐定时器

- **输入**：`runSchedulerTick()` 遍历 `kanbanTasksRef.current` 处理 missed run、due、lock 清理。
- **输出**：
  - tick 结束后扫描所有非 manual/paused 任务的 `schedule.nextRunAt`，取最小值。
  - 用 `setTimeout(max(nextRunAt - now, 5s))` 自续期。
  - 无到期任务时 timer 不设置，effect 完全休眠。
  - `typedKanbanTasks` 变更时 effect 重跑，立即补 tick 并重算唤醒点。
- **防抖自循环**：给 `updateTaskExecution` 增加等值短路，避免同一 `blockedReason`/`lastSource` 反复触发 store 写，进而防止 effect 自触发。

### 3. Engine task output snapshot：visibility gate

- **输入**：`status === "running"` 时 `setInterval(runRefresh, 5s)`。
- **输出**：`setVisibilityGatedInterval(runRefresh, 5s)`；隐藏时暂停，恢复可见时立即补一次。

### 4. Runtime dock：Rust 差量 emit + 60s 兜底

- **Rust**：
  - 在 `runtime/commands.rs` 新增 `publish_runtime_pool_snapshot_if_changed(app, snapshot)`。
  - 签名函数 `runtime_pool_rows_signature` 与前端 `areRuntimeRowsSignalEquivalent` 口径一致，并加入 `error` / `last_exit_reason_code` / `last_exit_message`，保证 dock 通知派生字段变化也能触发。
  - `run_reconcile_cycle` 后的 lib.rs 15s 循环、手动 `mutate_runtime_pool`、reconnect 路径均调用发布函数。
- **Frontend**：
  - `services/events.ts` 新增 `subscribeRuntimePoolChanged`。
  - `useGlobalRuntimeNoticeDock` 订阅事件并应用 snapshot；5s 轮询改为 60s 门控兜底。

### 兼容性

- `runtime-pool-changed` 事件为纯增量；旧代码仍可调用 `getRuntimePoolSnapshot()`，不破坏任何现有调用方。
- `setVisibilityGatedInterval` 已在本仓库多处使用，行为已验证。

### 不引入的复杂度

- 不新增 WebSocket、不新增后台 worker、不修改 store schema。
