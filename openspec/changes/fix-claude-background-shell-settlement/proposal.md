## Why

Claude Local CLI 在 Shell/PowerShell **后台任务**场景下，会先发出带结构化 `toolUseResult.backgroundTaskId` 的 tool result，再发出 terminal assistant `result`；后台任务本身仍在运行。当前 ccgui 在看到 `result` 后一律启动固定约 5 秒的 `CLAUDE_POST_RESULT_GRACE`，stdout 未 EOF 时对整个 Claude process tree 执行 `force_kill_process_group`（Unix `killpg` / Windows `taskkill /T /F`）。这会把 **Claude 合法托管的后台任务**与 **MCP/Stop-hook 继承管道的泄漏子进程**一并杀掉。

结果是：长测试、训练、数据处理在下一轮只能看到 “No completion record was found for this background shell command…”，任务静默中断。该行为已在 upstream issue [#983](https://github.com/zhukunpenglinyutong/desktop-cc-gui/issues/983) 报告，并在当前 v0.7.16 代码路径中复核仍成立（`src-tauri/src/engine/claude.rs`）。这是 runtime settlement 合同缺陷，不是 UI 文案问题，也不应靠缩短/关闭 grace 的最小补丁敷衍。

## What Changes

- 引入 **structured background task identity** 作为 turn-scoped settlement blocker：仅解析 stream 中的结构化 `backgroundTaskId`，禁止文本关键词猜测。
- 重写 Claude `result` 后的 settlement 状态机：
  - **无 active structured blocker** → 保留既有 5s grace + process-group kill（防 MCP/Stop-hook hang）。
  - **有 active structured blocker** → **禁止**通用 grace tree-kill；继续读 stream，等待 matching terminal notification / provider EOF / 用户 Stop。
  - blocker 清空后若进程仍因管道未 EOF → 再进入既有 grace 路径。
- 用精确 `threadId + turnId` 的 realtime activity 事件向前端投影 “等待后台 Shell” 状态；`TurnCompleted` / `TurnError` / 新 turn 清理临时态。
- 前端复用 `WorkingIndicator` 既有 1s 计时与 activity label，**不**新增 root-level polling 或逐 token 状态更新。
- 全平台同一决策逻辑（macOS / Linux / Windows）；kill 实现保持平台适配，但 **gate 条件平台中立**。
- 补齐 fake-stream 与单元回归：有/无 `backgroundTaskId`、matching/mismatched notification、Stop 强制收敛、Windows tree-kill 语义在决策层可测。

## 目标与边界

- **目标**：区分「assistant 正文已结束」与「provider 进程可安全收割」；有结构化后台任务时不得误杀；无结构化 id 时不得回归 generating hang。
- **边界**：只改 Claude Local CLI stream settlement 与其前端 waiting 投影；不改 Claude CLI 协议本身；不引入后台任务调度器/二次托管。
- **平台**：macOS / Linux / Windows 行为一致；kill 原语可不同，settlement 决策必须相同。

## 非目标

- 不删除 `CLAUDE_POST_RESULT_GRACE` / `CLAUDE_POST_RESULT_STDERR_DRAIN`（无 blocker 路径必须保留）。
- 不根据 “background / shell / task / 后台” 等自然语言猜测任务存活。
- 不在宿主侧 re-parent / 接管 Claude 已托管的 shell 进程（不成为第二进程管理器）。
- 不改 Codex / Gemini / OpenCode / Grok / Kimi 的 turn settlement。
  - **Codex**：长连接 app-server，`turn/completed` 不触发宿主 process-tree grace kill（与 #983 不同构）。
  - **Grok 等短进程引擎**：无 `CLAUDE_POST_RESULT_GRACE` / `force_kill_process_group` 路径；若未来「EOF 卡住」另开防 hang change。
- 不把后台任务输出做成完整 Task Center 产品（可后续迭代）；本 change 只保证 **不杀 + 可等待 + 可 Stop**。
- 不为 “未来可能有更多后台类型” 做通用 workflow 引擎。

## Capabilities

### New Capabilities

- `claude-background-task-settlement`: Claude 结构化 `backgroundTaskId` 的 turn-scoped blocker 生命周期、释放规则、与 process-tree kill 的互斥门闩、跨平台 settlement 状态机，以及 waiting 投影合同。

### Modified Capabilities

- `claude-turn-settlement-stream-lifecycle`: `result` 后 bounded grace/tree-kill 仅在 **无 active structured background-task blocker** 时适用；有 blocker 时不得走通用 5s force kill。

## Impact

| 层 | 影响面 |
|----|--------|
| Backend | `src-tauri/src/engine/claude.rs`（读循环 / grace / force kill 门闩）、`claude_stream_helpers.rs`（结构化 id 抽取）、可能的 `events.rs`（turn activity 事件）、`claude/tests_stream.rs` / `tests_core.rs` |
| Frontend | WorkingIndicator activity label 映射、realtime reducer 对 turn activity 的精确 turn 绑定、i18n（zh/en 至少） |
| Specs | 新增 capability + 修改既有 settlement lifecycle |
| Docs | 可选：perf streaming stall 设计文档中 grace 注释补例外条件 |
| Issue | 关闭/关联 [#983](https://github.com/zhukunpenglinyutong/desktop-cc-gui/issues/983) |

## 技术方案对比

| 选项 | 描述 | 取舍 |
|------|------|------|
| A. 取消 / 无限延长 grace | 一刀切不再 force kill | 会回归 MCP/Stop-hook「生成中永久卡住」；**否决** |
| B. 仅 Windows 特判放宽 grace | 报告平台优先 | 根因跨平台；Unix 同样可误杀；**否决为正规修复** |
| C. 文本启发式（含 background 字样则延后） | 实现快 | 误报/漏报高，违反结构化边界；**否决** |
| **D. Structured blocker + 条件 grace（推荐）** | 仅 `backgroundTaskId` 阻断 tree-kill；无 id 保留 5s grace；matching terminal 释放 | 正规、可测、全平台一致，保留 anti-hang 防线 |

采用 **D**。

## 验收标准

1. **有** structured `backgroundTaskId` 且后台任务 >5s：`result` 后 5s 内 **不得** process-tree kill；任务可自然完成或收到 matching terminal notification。
2. **无** `backgroundTaskId` 的 Windows/Unix pipe-tail（MCP/hook 模拟）：仍在约 5s grace 内收敛且 tree-kill 路径可用。
3. matching `task-id` + terminal status（completed/failed/stopped）释放 blocker；mismatched/malformed **不**释放。
4. blocker 全部释放后若 stdout 仍未 EOF，**再**进入既有 grace，不得无限 hang。
5. 用户 Stop：立即收敛（tree-kill 允许），Turn 以 stop/error 结束，临时 waiting 态清理。
6. UI：waiting 阶段展示可理解的「等待 Shell/后台任务」类文案，计时延续当前 turn 起点；Stop 可用；无 root 秒级轮询新增。
7. 平台：macOS / Linux / Windows 决策路径一致；至少决策层 + fake-stream 测试跨平台可跑；Windows 实机冒烟列入 verification。
8. 既有 unix grace 回归测试保持绿色；新增有/无 blocker 成对回归。
