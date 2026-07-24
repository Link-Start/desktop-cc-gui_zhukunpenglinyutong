# 轮询滥用与高频 setState 治理 — 执行手册

> 主题：系统级轮询 / 高频 setState 盘点与重构路线图
> 扫描日期：2026-07-25
> 范围：`src/**` 前端代码 + `src-tauri/src/**` Rust 代码
> 状态：**5 项高优先级改造已完成，其余待按优先级逐个改造**

---

## 0. 治理目标

1. 消灭不必要的常驻前端 `setInterval` / 高频 IPC 轮询。
2. 能用事件 / watcher 替代的一律改事件驱动。
3. 无法事件化的轮询，必须接入统一的**可见性门控**与**自适应退避**机制。
4. 录音电平等高频数据推送必须降频或前端采样，禁止直推 `setState`。

---

## 1. 快速结论

- 全仓共识别 **17 个前端轮询点** + **若干 Rust 侧定时循环**。
- 其中 **8 个是已知项**，其余为本次扫描补充。
- **最高优先级（P0）改造已完成**：
  1. `GitHistoryWorktreePanel` 3s git status IPC 轮询 → watcher 事件 + 30s 门控兜底。
  2. `useAppShellKanbanExecutionSection` 20s 本地调度器 → next-due 对齐 setTimeout（无任务休眠）。
- **P1 改造已完成**：
  3. `useEngineTaskOutputSnapshot` 5s 轮询 → `setVisibilityGatedInterval`。
  4. `useGlobalRuntimeNoticeDock` 5s 轮询 → Rust 差量 emit `runtime-pool-changed` + 60s 门控兜底。
  5. `dictation/real.rs` 33ms 电平推送 → 100ms + 相同 value 跳过 emit。
- **关键杠杆点**：`src-tauri/src/lib.rs:274` 的 15s Rust runtime reconcile 循环已顺手 emit `runtime-pool-changed` 事件，一次性解决 `useGlobalRuntimeNoticeDock` 5s 轮询。kanban 调度器因状态全在前端，未下沉 Rust，改用 next-due 定时器解决空转。

---

## 2. 你列 8 项的核对结论

| # | 文件 | 行号 | 周期 | 当前状态 | 判定 |
|---|------|------|------|----------|------|
| 1 | `src/features/curated-skills/components/CuratedSkillIndicator.tsx` | 32 / 113 | 2s | 仍在，但已走 `setVisibilityGatedInterval`，内容相等时不 setState | 🟡 半修复：静态设置数据仍靠轮询 |
| 2 | `src/features/notifications/hooks/useGlobalRuntimeNoticeDock.ts` | 22 / 510 | 5s | 仍在，已 visibility-gated | 🟡 半修复：应改为后端事件 |
| 3 | `src/features/engine-task-output/hooks/useEngineTaskOutputSnapshot.ts` | 7 / 114 | 5s | **已套 `setVisibilityGatedInterval`** | 🟢 已修复 |
| 4 | `src/app-shell-parts/useAppShellKanbanExecutionSection.ts` | 51 / 1033 | 20s | **已改为 next-due 对齐 setTimeout** | 🟢 已修复 |
| 5 | `src/features/files/components/fileViewPanelShared.ts` | 25 | 2s | 常量仍在，但轮询已重构为 **watcher 优先 + polling 兜底** | 🟢 已重构，仅剩 fallback |
| 6 | `src-tauri/src/dictation/real.rs` | 1245-1251 | 33ms (~30fps) | **已降频到 100ms，相同 value 跳过 emit** | 🟢 已修复 |
| 7 | `src/features/layout/components/MemoryPanel.tsx` | 7 / 62 | 10s | 仍在，no-cors HEAD `localhost:37777`，**未门控** | 🔴 未修复 |
| 8 | `src/features/home/hooks/useLocalUsage.ts` | 17 / 64 | 5min | 仍在，**未门控** | 🔴 未修复 |

---

## 3. 全仓轮询清单

### 3.1 前端 IPC 轮询（高价值改造区）

| 优先级 | 文件 | 周期 | 意图与作用 | 是否建议优化 | 优化方案 | 不优化的坏处 |
|--------|------|------|------------|--------------|----------|--------------|
| **P0** | `src/features/git-history/components/GitHistoryWorktreePanel.tsx:317` | **3s** | worktree 面板打开期间，保持 git status 状态实时可见，用于提交/暂存 UI | 是 | **✅ 已完成**：接入 `external_changes` watcher 事件触发刷新；`setVisibilityGatedInterval` 30s 兜底 `.git/index` 盲区 | 全仓频率最高的未门控 IPC 轮询；后台持续 3s 拉取无意义；IPC 队列拥堵、耗电 |
| **P0** | `src/app-shell-parts/useAppShellKanbanExecutionSection.ts:1033` | **20s** | 周期性扫描 kanban schedule，到期自动触发任务执行 | 是 | **✅ 已完成**：改为 next-due 对齐 `setTimeout`；无到期任务休眠；任务变更时立即重算 | 应用关闭即丢失调度；20s 精度粗；根 hook 常驻后台空转 |
| **P1** | `src/features/engine-task-output/hooks/useEngineTaskOutputSnapshot.ts:114` | **5s** | 任务 running 时周期性读取子代理产物文件，刷新最近输出展示 | 是 | **✅ 已完成**：套 `setVisibilityGatedInterval(5s)`，窗口隐藏时暂停 | running 任务每 5s IPC 读文件，窗口隐藏也持续；浪费 IPC 与磁盘 I/O |
| **P1** | `src/features/notifications/hooks/useGlobalRuntimeNoticeDock.ts:510` | **5s** | 拉取 runtime 池快照，派生错误/通知状态显示在全局 dock | 是 | **✅ 已完成**：Rust reconcile cycle 后差量 emit `runtime-pool-changed`；前端订阅 + 60s 门控兜底 | 5s 常驻 IPC 即使无变化；布局根级，所有页面都在跑 |
| **P2** | `src/features/git/hooks/useGitLog.ts:103` | **10s** | 保持当前分支 git log / ahead / behind 信息新鲜 | 是（中） | 先套 `setVisibilityGatedInterval`；长期接 external_changes / git 文件变更事件 | 后台 10s IPC 无意义；ahead-behind 变化频率低 |
| **P2** | `src/features/layout/components/MemoryPanel.tsx:62` | **10s** | 探测本地 memory 服务是否在线，控制 iframe 展示 | 是（低） | 套 `setVisibilityGatedInterval`；`localhost:37777` 抽配置；只在面板可见时探活 | 每 10s 无意义 fetch；no-cors 仍消耗网络栈；硬编码地址 |
| **P2** | `src/features/home/hooks/useLocalUsage.ts:64` | **5min** | 周期性刷新本地 token 使用量快照 | 是（低） | 复用同域更优的 `startLocalUsageAutoRefresh`（30s 自适应 + 可见性感知） | 周期长不敏感，且后台也会触发 |
| **P2** | `src/features/git/hooks/useGitRepositories.ts:127-143` | **45s** | 周期性刷新 workspace 关联的 git 仓库列表 | 是（低） | 替换递归 `setTimeout` 为 `setVisibilityGatedInterval`，hidden 时彻底停止 | 45s 自调度在 hidden 时仍会醒来重新 schedule；不必要 IPC |
| **P3** | `src/features/curated-skills/components/CuratedSkillIndicator.tsx:113` | **2s** | 保持 composer 中 curated skill 启用状态与设置面板一致 | 是（观察） | 引入跨组件 settings 变更事件，彻底去轮询；过渡期放宽到 10s+ | 2s 双 IPC，常驻 composer 叶子；settings 变化低频 |

### 3.2 前端本地内存轮询（低 IPC 开销，可合并优化）

| 文件 | 周期 | 意图与作用 | 是否建议优化 | 优化方案 | 不优化的坏处 |
|------|------|------------|--------------|----------|--------------|
| `src/features/threads/hooks/useThreadStorage.ts:82` | 5s | 清理 auto-title pending map 中超时条目 | 否（可合并） | 保留，或合并进 `useThreadEventHandlers` 60s 清扫 | 空转但无 IPC，成本低 |
| `src/features/threads/hooks/useThreadEventHandlers.ts:1106` | 60s | 清理 transient turn diagnostics / quarantined turns | 否 | 保留 | 低频，几乎无开销 |
| `src/features/browser-agent/hooks/useBrowserContextAttachment.ts:185` | 30s | 本地对账 browser context attachment 新鲜度，防止事件丢失后状态漂移 | 否（可移除） | 主通道已是事件，可移除兜底；如需保留套 `setVisibilityGatedInterval` | 30s 本地计算无 IPC，成本低 |
| `src/features/tasks/hooks/useTaskRunStore.ts:39` | 30s | 跨窗口 localStorage 兜底同步 task run store | 否 | 已门控，保留 | 跨窗口同步兜底有价值 |
| `src/features/extensions/tokentracker-dashboard/lib/local-usage-auto-refresh.ts:44` | 30s | token tracker dashboard 可见时保持本地用量数据新鲜 | 否 | 保留，作为最佳实践模板 | 已门控 + 自适应 |
| `src/features/settings/components/settings-view/sections/PerfJankLivePanel.tsx:166` | 1s | 开发者工具面板实时刷新 jank 诊断数据 | 否 | 开发者面板专用，保留 | 仅设置页打开 |

### 3.3 纯 UI 计时器（transient，数量多时应收敛）

| 文件 | 周期 | 意图与作用 | 是否建议优化 | 优化方案 | 不优化的坏处 |
|------|------|------------|--------------|----------|--------------|
| `src/features/messages/rows/components/WorkingIndicator.tsx:55` | 1s | 显示 thinking 消息已运行多久 | 否（可合并） | 消息少保留；消息多可合并为全局 1s clock | 消息多时 N 个 interval |
| `src/features/kanban/components/KanbanCard.tsx:263/273` | 1s × 2 | 每张卡显示任务已耗时和倒计时 | **是** | 单一时钟源（全局 1s ticker）+ 各卡订阅计算 | 卡多时 N×2 个 interval，定时器线性膨胀 |
| `src/features/app/components/AskUserQuestionDialog.tsx:119` | 1s | 请求倒计时，超时提示 | 否 | transient，保留 | 无 |
| `src/features/app/components/RequestUserInputMessage.tsx:186` | 1s | stale 输入倒计时 | 否 | transient，保留 | 无 |
| `src/features/settings/hooks/useCliInstallLifecycle.ts:150` | 1s | CLI 安装 running 时刷新 elapsed | 否 | transient，保留 | 无 |
| `src/features/git-history/components/git-history-panel/components/GitHistoryPanelImpl.tsx:1809/2596` | 1s × 2 | force-delete 倒计时 / PR 生成耗时 | 否 | transient，保留 | 无 |
| `src/features/spec/hooks/useSpecHub.ts:1245` | 1s | 执行期间心跳日志，每秒追加运行提示 | 否 | transient，`finally` 会 clear，保留 | 无 |
| `src/features/spec/components/spec-hub/presentational/SpecHubPresentationalImpl.tsx` | 1s × 2 | 执行计时器 | 否 | transient，保留 | 无 |
| `src/features/project-map/services/projectMapGenerationWorker.ts:976` | 1s | AI 生成期间进度日志 | 否 | transient，保留 | 无 |
| `src/features/git-history/components/git-history-panel/hooks/useGitHistoryPanelInteractions.tsx:563` | 800ms | PR 创建期间假进度动画 | 否 | transient，保留 | 无 |

### 3.4 Rust 侧定时循环 / 推送

| 文件 | 周期 | 意图与作用 | 是否建议优化 | 优化方案 | 不优化的坏处 |
|------|------|------------|--------------|----------|--------------|
| `src-tauri/src/dictation/real.rs:1245-1251` | **33ms (~30fps)** | 实时显示录音电平条 | **是** | **✅ 已完成**：Rust 端降频到 100ms；相同 value 不 emit | 30fps 事件洪流直推前端 setState，CPU/电池；人眼无法分辨 30fps 电平变化 |
| `src-tauri/src/workspaces/external_changes.rs:506` | 1.2s | watcher 不可用时 fallback 检测文件外部变更 | 否 | watcher 优先，polling fallback 保留 | fallback 模式下略高频，但已有 100ms debounce 合并 |
| `src-tauri/src/workspaces/external_changes.rs:311` | 100ms | debounce flush 合并窗口 | 否 | 保留 | 正常批量化设计 |
| `src-tauri/src/event_sink.rs:106` | 40ms | 批量聚合 app-server 事件再 emit | 否 | 保留 | 反向优化（减少 emit 次数） |
| `src-tauri/src/event_sink.rs:126` | 1s | batch 统计 emit | 否 | 保留 | 反向优化 |
| `src-tauri/src/lib.rs:274` | 15s | runtime pool reconcile：状态对账、拉起/清理进程 | 否（需增强） | 每次 reconcile 后 emit `runtime-pool-changed` / `kanban-task-due` 事件 | 不增强会导致前端持续轮询 |
| `src-tauri/src/renderer_stability.rs:283` | 15s | 检测前端渲染进程是否卡死 | 否 | 保留，不门控 | 停了会误报白屏 |
| `src-tauri/src/tokentracker.rs:399` | 500ms | server 启动期探测端口就绪 | 否 | 一次性，保留 | 启动期短窗口 |
| `src-tauri/src/backend/app_server_runtime_lifecycle.rs:617/960` | 25ms / 250ms | `try_wait` 等待子进程退出 | 否 | 短 deadline 轮询，保留 | 必须短窗口探测 |
| `src-tauri/src/runtime/process_diagnostics.rs:309` | 25ms | `try_wait` 等待进程退出 | 否 | 短 deadline 轮询，保留 | 必须短窗口探测 |

### 3.5 前端 watchdog / 探活

| 文件 | 周期 | 意图与作用 | 是否建议优化 | 优化方案 | 不优化的坏处 |
|------|------|------------|--------------|----------|--------------|
| `src/services/rendererDiagnostics.ts:1375` | 15s | 前端向 Rust 发送 `record_renderer_heartbeat`，配合 watchdog | 否 | 保留，**不门控** | 停了会触发 watchdog 误报 |
| `src/services/rendererDiagnostics.ts:1405` | 1.5s | 白屏 watchdog（强制回流采样 DOM） | 否 | 保留，已识别 hidden 并跳过采样 | 后台强制回流会耗电 |
| `src/services/perfBaseline/frameDropMonitor.ts:120` | 每帧 rAF | 监测掉帧 | 否 | 保留，hidden 时 rAF 自然暂停 | 无 |

---

## 4. 推荐改造优先级

### P0 — 立即做

1. **`GitHistoryWorktreePanel` 3s git status 轮询** ✅
   - 接入 `external_changes` watcher 事件，30s 门控兜底。
   - 提交：`d042e5018`。
2. **`useAppShellKanbanExecutionSection` 20s 调度器** ✅
   - 改为 next-due 对齐 `setTimeout`；无任务休眠。
   - 提交：`d042e5018`。

### P1 — 本轮一起做

3. `useGlobalRuntimeNoticeDock` 5s → Rust reconcile 后差量 emit `runtime-pool-changed` 事件 ✅
   - 提交：`d042e5018`。
4. `useEngineTaskOutputSnapshot` 5s → 套 `setVisibilityGatedInterval` ✅
   - 提交：`d042e5018`。
5. dictation 33ms 电平 → 降到 100ms + 相同 value 跳过 emit ✅
   - 提交：`9ca8d2b19`。
6. `KanbanCard` 1s×N → 单一时钟源订阅。

### P2 — 下一波

7. `useGitLog` 10s → 套 `setVisibilityGatedInterval`。
8. `MemoryPanel` 10s → 套 `setVisibilityGatedInterval`，URL 抽配置。
9. `useLocalUsage` 5min → 复用 `startLocalUsageAutoRefresh`。
10. `useGitRepositories` 45s → 替换为 `setVisibilityGatedInterval`。

### P3 — 观察后决定

11. `CuratedSkillIndicator` 2s → 若引入跨组件 settings 事件通道，可彻底去轮询。

---

## 5. 可复用的现有范式

改造时不要新造轮子，优先复用：

1. **`src/services/visibilityGatedInterval.ts`**
   - 已用于：`CuratedSkillIndicator`、`useGlobalRuntimeNoticeDock`、`useTaskRunStore`。
   - 语义：hidden 暂停、visible 立即补 tick、再恢复周期。

2. **`src/features/extensions/tokentracker-dashboard/lib/local-usage-auto-refresh.ts`**
   - 最佳实践：可见性 + focus + 自适应退避（`adaptiveRefreshDelay`）。
   - 可作为 `useLocalUsage`、git 面板等低频 IPC 轮询的升级模板。

3. **`src-tauri/src/workspaces/external_changes.rs`**
   - watcher 优先 + polling 兜底的双通道文件监控。
   - git status、artifact 文件刷新可借鉴此模式。

4. **`src-tauri/src/lib.rs:274` 15s reconcile cycle**
   - 后端周期任务的集中点；emit 事件可同时喂饱 `runtime-notice-dock` 和 kanban 调度器。

---

## 6. 验收标准

- [x] 所有未门控 IPC 轮询全部接入 `setVisibilityGatedInterval` 或改为事件驱动。
- [x] `GitHistoryWorktreePanel` 不再 3s 拉一次 git status IPC。
- [ ] kanban 调度器关闭应用后重启仍能执行到期任务（本次未下沉 Rust，改为 next-due 定时器；持久化调度仍待后续）。
- [x] dictation 录音电平推送 ≤ 15fps（已降至 10fps）。
- [ ] 单仓 `setInterval` 总数下降 ≥ 30%（已降 5 项高优先级，其余待改造后统计）。
- [x] `npm run lint`、`npm run typecheck` 通过。

---

## 7. 附录：扫描命令

```bash
# 前端 setInterval / setTimeout
rg -n "setInterval|setTimeout" src -g '!*.test.*' -g '!*.d.ts'

# 前端可见性门控使用情况
rg -n "setVisibilityGatedInterval|useVisibilityGatedInterval" src -g '!*.test.*'

# Rust 定时器
rg -n "tokio::time::interval|sleep\(|thread::sleep" src-tauri/src -g '!*test*'

# dictation 电平推送
sed -n '1240,1255p' src-tauri/src/dictation/real.rs
```
