## Why

最近对客户端 4 处常驻轮询做 IPC/电量审计，发现它们即使窗口隐藏也按固定周期唤醒：

- `GitHistoryWorktreePanel.tsx:317` 3s `git status` 轮询
- `useAppShellKanbanExecutionSection.ts:1033` 20s kanban schedule 扫描
- `useEngineTaskOutputSnapshot.ts:114` 5s running 任务产物读文件轮询
- `useGlobalRuntimeNoticeDock.ts:510` 5s runtime pool 快照轮询

这些轮询在主线程堆叠，造成「窗口后台仍占 CPU / 唤醒磁盘 / 拥堵 IPC」，在笔记本场景下尤其耗电。仓库已有 `setVisibilityGatedInterval`、`detached-external-file-change-batch` event hub、Rust 15s reconcile cycle 等基础设施，但没有被这四处利用。本次变更用「事件驱动 + 门控慢速兜底」替代固定轮询，保证功能语义不变，后台静默期 IPC 归零或大幅下降。

## What Changes

- `GitHistoryWorktreePanel`：订阅 Rust `detached-external-file-change-batch`（1s 节流），按 `workspaceId` 过滤并刷新 git status；用 `setVisibilityGatedInterval(30s)` 覆盖 `.git/index` 这类 watcher 未必捕获的盲区。
- `useAppShellKanbanExecutionSection`：将固定 20s 轮询改为按最近 `schedule.nextRunAt` 自续期的 `setTimeout`；无到期任务时完全休眠。同时给 `updateTaskExecution` 加等值短路，避免 scheduler tick 每轮对 processing/locked 任务写入相同 store 版本。
- `useEngineTaskOutputSnapshot`：running 任务 5s 轮询改为 `setVisibilityGatedInterval(5s)`，隐藏窗口暂停。
- `useGlobalRuntimeNoticeDock`：Rust reconcile 与手动 mutation 后签名比对 snapshot，仅语义变化时 emit `runtime-pool-changed`；前端订阅事件，并用 `setVisibilityGatedInterval(60s)` 兜底。

## 目标与边界

- 目标：消除上述 4 个常驻轮询在窗口隐藏 / 无变化 / 无任务时的空转。
- 目标：保持用户可见语义等价——worktree 状态实时可见、kanban 到期任务准点触发、running 输出持续刷新、runtime dock 错误状态及时更新。
- 边界：不引入新 dependency，不修改 git/runtimemanager/kanban store 的数据模型，不迁移 kanban scheduler 到 Rust（状态机搬迁成本远超收益）。
- 边界：事件通道失败后仍保留慢速兜底，不破坏最终一致性。

## 非目标

- 不减少事件驱动通道的实时性。
- 不改动 `external_changes.rs` watcher 逻辑或 `.git` 忽略策略。
- 不重构 kanban store 或把 scheduler 下沉。

## 方案取舍

1. **推荐：事件驱动 + 门控兜底。** 复用现有 watcher、event hub、reconcile cycle 与 `setVisibilityGatedInterval`，改动手术式，风险最低。
2. **备选：kanban scheduler 下沉 Rust。** 可解决应用关闭丢调度，但需把完整 kanban 状态机、thread status、lock、launch 闭包搬入 Rust，diff 与回归面过大，违反 YAGNI。
3. **备选：仅把所有 setInterval 套 visibility gate。** 改动更小，但 worktree/dock 仍 3s/5s 前台高频 IPC，事件驱动的优化没有做满，因此拒绝。

## Capabilities

### New Capabilities

- `client-polling-reduction-runtime-pool-diff-event`：Rust 侧按语义签名差量发布 runtime pool 变化，前端订阅替代轮询。

### Modified Capabilities

- `git-history-worktree-panel`: 状态刷新由 3s 裸轮询改为 watcher 事件 + 30s 门控兜底。
- `kanban-scheduler-tick`: 由固定 20s 轮询改为 next-due 对齐的 setTimeout，无任务休眠。
- `engine-task-output-snapshot`: running 任务产物刷新遵循 visibility gate。
- `global-runtime-notice-dock`: runtime 池更新由 5s 轮询改为 Rust 差量事件 + 60s 门控兜底。

## Impact

- Frontend：`src/features/git-history/components/GitHistoryWorktreePanel.tsx`、`src/app-shell-parts/useAppShellKanbanExecutionSection.ts`、`src/features/engine-task-output/hooks/useEngineTaskOutputSnapshot.ts`、`src/features/notifications/hooks/useGlobalRuntimeNoticeDock.ts`、`src/services/events.ts`。
- Backend：`src-tauri/src/runtime/commands.rs`、`src-tauri/src/lib.rs`。
- 依赖：无新增 package。

## 验收标准

- `npm run typecheck`、`npm run lint`、相关 Vitest 通过。
- `cargo check` 通过；受影响的 Rust runtime 测试基线不变（已知两个与进程终止相关的 flake 不在本次范围）。
- 手动 smoke：worktree 外部改文件后 ~1s 刷新；kanban 1 分钟后到期的任务在 ±5s 内触发；running 任务隐藏窗口期间无 `readEngineTaskOutputArtifact` IPC；runtime dock 在 engine 启停后 1s 内更新。
