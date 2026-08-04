## Context

### 现状（v0.7.16 代码事实）

Claude Local CLI 每 turn 起进程，stdout JSONL。`src-tauri/src/engine/claude.rs`：

1. 见到 `type == "result"` → 记 `result_seen_at`
2. 之后读 stdout 使用 `CLAUDE_POST_RESULT_GRACE`（5s）超时
3. 超时 → `settled_by_grace = true` → `force_kill_process_group`
   - Unix：`kill(-pid, SIGKILL)`
   - Windows：`taskkill /PID … /T /F`
4. 再发 `TurnCompleted`（grace 路径跳过非零 exit 失败判定）

该机制来自 2026-07-04 防 hang 修复（archive：`retro-claude-turn-settlement-and-stream-lifecycle`）：MCP 子进程 / Stop hook 继承 stdio 时 CLI 不 EOF，UI 永久 generating。主 spec `claude-turn-settlement-stream-lifecycle` 只写了 “result 后 bounded grace”，**没有**区分结构化后台 Shell 任务。

### 冲突模型

| 子进程类型 | 是否应被 grace kill | 当前行为 |
|------------|---------------------|----------|
| MCP / Stop-hook 占管道泄漏 | 是（bounded） | 正确 |
| Claude 托管的 background shell（有 `backgroundTaskId`） | 否（直到 task 终态 / 用户 Stop） | **错误：一并杀掉** |

### 权威输入

- Issue：[#983](https://github.com/zhukunpenglinyutong/desktop-cc-gui/issues/983)
- 代码：`claude.rs` grace / force kill；`claude_stream_helpers.rs` 的 `toolUseResult` 文本抽取（不读 id）
- 前端：`agentTaskNotification.ts` 可解析 `<task-id>` / `<status>`，但不参与进程生命周期
- UI：`WorkingIndicator` 已有 1s 计时器 + `activityLabel` / `processingStartedAt`

## Goals / Non-Goals

**Goals**

1. Settlement 状态机显式区分：`assistant_result_ready` vs `provider_process_reapable`。
2. 仅结构化 `backgroundTaskId` 可阻断 tree-kill。
3. 无 blocker 时 5s grace 行为与现网一致（anti-hang 不回退）。
4. 全平台同一决策表；kill 原语保持平台实现。
5. 可观测 waiting；用户可 Stop；可测可回归。

**Non-Goals**

- 宿主接管/迁移后台 PID；重写 Claude 后台任务协议。
- 通用跨引擎 background task framework。
- 删除 grace / 仅调大数字。

## Settlement 状态机

```
                    ┌─────────────────────┐
                    │   StreamingTurn     │
                    └──────────┬──────────┘
                               │ type=result
                               ▼
                    ┌─────────────────────┐
                    │ ResultSeen          │
                    │ (assistant ready)   │
                    └──────────┬──────────┘
               active_blockers?│
          ┌────────────────────┼────────────────────┐
          │ yes                │ no                 │
          ▼                    ▼                    │
 ┌──────────────────┐  ┌──────────────────┐         │
 │ WaitBgTasks      │  │ GraceWaitEof     │◄────────┘
 │ (no tree-kill)   │  │ (≤5s)            │  blockers cleared
 └────────┬─────────┘  └────────┬─────────┘  but pipe still open
          │                     │ timeout
          │ EOF / all clear     ▼
          │            ┌──────────────────┐
          │            │ ForceKillTree    │
          │            │ + settled_grace  │
          ▼            └────────┬─────────┘
 ┌──────────────────┐           │
 │ FinalizeSuccess  │◄──────────┘
 │ TurnCompleted    │
 └──────────────────┘

任意阶段 User Stop → ForceKillTree → TurnError("Session stopped.") + clear blockers/activity
```

### 状态语义

| 状态 | stdout 读 | tree-kill | TurnCompleted |
|------|-----------|-----------|---------------|
| StreamingTurn | 阻塞读 | 否（除非 Stop） | 否 |
| ResultSeen | — | — | 否 |
| WaitBgTasks | 继续读（可收 notification / 更多事件） | **禁止 grace kill** | 否 |
| GraceWaitEof | 限时读 | 超时后是 | 超时或 EOF 后是 |
| ForceKillTree | — | 是 | 之后是（成功路径） |
| FinalizeSuccess | — | — | 是 |

**关键不变量**

- `WaitBgTasks` 期间 **不得** 因 `CLAUDE_POST_RESULT_GRACE` 触发 `force_kill_process_group`。
- `GraceWaitEof` 仅当 `active_background_task_ids` 为空。
- `TurnCompleted` 只在 Finalize；不得在 WaitBgTasks 提前发 completed 再偷偷杀进程。

## Decisions

### D1 — Structured id only（硬边界）

**Accept**：只从 stream JSON 抽取：

- `toolUseResult.backgroundTaskId`（string，trim 后非空）
- 兼容 snake_case：`tool_use_result.background_task_id`（若出现）
- 嵌套 object 一层：`toolUseResult.background_task.backgroundTaskId` **不做**（YAGNI；若实盘样本需要再加，须测试钉死）

**Reject**：正文/工具输出字符串正则猜 “background task #xxx”。

登记时机：处理到含该字段的 tool_result / user tool_result 事件时 `insert` 进 turn-scoped set。  
同一 id 重复登记幂等。

### D2 — Turn-scoped active set

```text
active_background_task_ids: HashSet<String>  // per send_message / turn
```

- 作用域 = 当前 `turn_id` 的读循环局部状态（或 `clear_turn_ephemeral_state` 一并清理的结构）。
- **禁止** 跨 turn 残留；新 turn 从空 set 开始。
- 不持久化到磁盘（重启后 CLI session 本身也丢运行中后台任务，与 Claude 一致）。

### D3 — 释放规则（matching terminal only）

从后续 stream 行解析 terminal 通知，**全部**满足才 `remove(id)`：

1. 能解析出 `task-id`（优先 structured；其次与现有前端一致的 `<task-notification><task-id>…` 块，但解析在 **后端 settlement** 执行，避免前后端双源真相）。
2. `task-id` **精确等于** set 中某 id。
3. `status` ∈ `{completed, failed, stopped}`（大小写不敏感）；未知 status **不**释放。

**不释放**：

- mismatched id
- 缺 status / 非终态 status（如 `running`）
- malformed XML/JSON
- 仅 assistant 散文提到 task id

**全部清空后**：

- 若 stdout 已 EOF 且进程可 wait → 直接 FinalizeSuccess（不杀或按正常 wait）。
- 若管道仍开 → 进入 `GraceWaitEof`（恢复 anti-hang）。

### D3b — Grace re-arm 时钟（已锁定）

**锁定：从进入 `GraceWaitEof` 的时刻起完整 `CLAUDE_POST_RESULT_GRACE`（默认 5s），不得用 `result_seen_at` 的「剩余时间」。**

| 场景 | 时钟 |
|------|------|
| result 已见、**从未**有过 blocker、直接 GraceWaitEof | 从 **首次 result 时刻**起算 5s（与现网一致） |
| 曾进入 WaitBgTasks，后 blockers 清空仍未 EOF | 从 **清空时刻**起 **重新完整 5s**（full re-arm） |
| WaitBgTasks 持续 60s 后清空 | remaining **不是 0**，而是新的 5s |

**禁止**：`remaining = GRACE - result_seen_at.elapsed()` 在 WaitBgTasks 之后复用（会导致 notification 后立即 tree-kill）。

实现草图：

```text
grace_deadline: Option<Instant>  // None while WaitBgTasks or before result

on result (first time) and active.is_empty():
  grace_deadline = Some(now + GRACE)

on active becomes empty after was non-empty (and result_seen and !eof):
  grace_deadline = Some(now + GRACE)  // full re-arm

while WaitBgTasks (active non-empty):
  grace_deadline = None
  wait next_line without grace timeout
```

### D4 — provider EOF 与 set 的关系

- **EOF 且 set 非空**：进程已结束，无法再收 notification → FinalizeSuccess（或若 exit 非零且非 grace-kill 路径，按现有失败规则）。后台任务可能被 OS 收割；这是 provider 退出语义，不是宿主误杀。
- **EOF 且 set 空**：现有成功/失败路径。
- **非 EOF 且 set 非空**：停在 WaitBgTasks。

### D5 — 不设“无限长硬超时”作为 P0

长训练/测试可能远超分钟级。P0 **不**用第二个全局 timer 替代 grace 误杀。  
收敛手段：

1. matching terminal notification  
2. provider EOF  
3. 用户 Stop  

若后续产品要 “12h 安全阀”，另开 change，且必须 UI 明示。

### D6 — 跨平台 kill 门闩同一、实现分流

```text
can_force_kill_for_grace =
  result_seen
  && active_background_task_ids.is_empty()
  && grace_elapsed
```

- `force_kill_process_group` 本体保持 `#[cfg(unix)]` / `#[cfg(windows)]`。
- **禁止** Windows 单独 “多等 N 秒” 或 Unix 单独 “不杀” 的平行策略。
- Windows 测试：决策层与 fake stream 在所有平台跑；`taskkill /T` 行为用集成/文档冒烟，不强制 CI Windows runner 才合入（与现有 unix-only grace 测试策略对齐，并 **新增** 平台中立的 set/gate 单测）。

### D7 — Waiting 投影事件（精确 turn 映射）

新增（或等价扩展）realtime 事件，推荐：

```text
type: "turn:activity"
workspaceId, turnId
phase: "waiting_background_tasks" | "settling" | "clear"
activeBackgroundTaskIds: string[]
activeCount: number
```

规则：

- 首次进入 WaitBgTasks → emit waiting  
- set 变化 → 可 debounce 或仅 count 变化时 emit（禁止逐 token）  
- Finalize / TurnError / clear_turn_ephemeral → emit clear 或依赖 terminal 事件清理  
- 前端 reducer：**仅当** event.turnId === 当前 live turn 才应用；terminal/new-turn 丢弃临时态  

**Reject**：把 waiting 塞进高频 `text:delta`；root store 秒级轮询。

### D8 — 前端 WorkingIndicator

- `isThinking` 在 WaitBgTasks 期间保持 true（因 TurnCompleted 未发）。
- `activityLabel` / `primaryLabel` 映射 i18n：  
  - zh：`等待 Shell 命令…` / `等待后台任务（n）…`  
  - en：`Waiting for shell…` / `Waiting for background tasks (n)…`
- `processingStartedAt` 使用 **本 turn 开始时间**，不在进入 waiting 时重置（沿用已用时间）。
- Stop 按钮保持现有 interrupt 链路。

### D9 — stderr drain 不变

`CLAUDE_POST_RESULT_STDERR_DRAIN`（2s）在 Finalize 阶段仍适用。WaitBgTasks 期间正常读 stdout；不提前 abort stderr reader。

### D10 — Feature flag

默认 **开启** 正确行为（这是 bugfix，不是实验功能）。  
可选 debug env：`CCGUI_CLAUDE_BG_TASK_SETTLEMENT=0` 回退旧 grace-only（仅应急回滚，不进设置页）。  
正式产品设置页 **不** 暴露“允许误杀后台任务”开关。

### D11 — 与 Shared / Native 会话

- Native Claude 与 Shared 上 Claude execution 共用 `ClaudeSession::send_message` 路径 → **一处修复两端受益**。
- 不改 Shared V2 状态机；只保证 Claude adapter 不再误杀。

## 解析与事件流（实现草图）

```text
on_stream_json(event):
  if id = extract_background_task_id(event):
      active.insert(id)
      maybe_emit_activity(waiting)

  if event.type == "result":
      result_seen = true

  if note = extract_task_notification(event):  // XML or structured
      if note.task_id in active && is_terminal(note.status):
          active.remove(note.task_id)
          maybe_emit_activity(...)

  // read-loop timeout selection — 所有 next_line 入口（含 Windows text coalesce 分支）共用:
  if !result_seen:
      wait unbounded (existing first-event rules)
  else if !active.is_empty():
      wait next_line without grace timeout   // WaitBgTasks; grace_deadline = None
  else:
      wait next_line until grace_deadline    // GraceWaitEof; deadline 见 D3b
```

`extract_background_task_id` 与 `extract_terminal_task_notification` 放在 `claude_stream_helpers`（纯函数，易单测）。

### Wire 抽取路径（阶段 1 钉死，可扩展但须测试）

**登记 `backgroundTaskId`（仅 structured，不猜正文）：**

1. `event.toolUseResult.backgroundTaskId`（string）
2. `event.toolUseResult.background_task_id`
3. `event.tool_use_result` 同上 camel/snake
4. id trim 后非空；长度 ≤128；set 容量 ≤64（超额拒绝登记 + warn）

**释放 terminal notification：**

1. 优先 structured：`taskId`/`task_id` + `status` 在 event 根或嵌套 object
2. 否则从可抽取文本（`extract_result_text`、content text blocks、字符串字段）解析与 FE 对齐的 `<task-notification>…` / entity-escaped 形态
3. `status ∈ {completed, failed, stopped}`（大小写不敏感）且 `task-id` 精确匹配才 remove

**晚到 id：** result 已见且 grace 进行中时，若随后登记到 structured id，必须取消 grace-kill 意图并进入 WaitBgTasks。

## Risks / Trade-offs

| 风险 | 影响 | 缓解 |
|------|------|------|
| Claude 变更字段名 / 漏发 backgroundTaskId | 仍走 grace，任务被杀 | 文档钉字段；实盘抓包后扩兼容键；不猜文案 |
| notification 永不来且进程不退出 | UI 长时间 waiting | 用户 Stop；D5 不假超时；日志打 active ids |
| 过早 Finalize 仍 kill | 回归 bug | 不变量测试：WaitBgTasks 禁止 force_kill |
| activity 事件刷屏 | 渲染 jank | 仅 set 变化 emit；禁 root 链数组追加风暴 |
| 双源解析（FE 已有 task-notification） | 行为漂移 | settlement 以后端 set 为准；FE 只展示 |
| Windows `/T` 杀树过宽 | 误杀 | 有 blocker 时根本不调用 taskkill；无 blocker 保持现状 |
| 安全：恶意 stream 注入海量 task id | 内存 | id 长度/数量上限（如 id ≤128 chars，set ≤64）静默丢弃超额并 warn |

## Migration Plan

1. 落地 helpers + 状态机 + 测试（默认 on）。  
2. 落地 turn:activity + FE label + i18n。  
3. 保留 env 回滚开关。  
4. 验证：unix grace 旧测 + 新 blocker 测 + Windows 人工冒烟。  
5. sync main specs → archive change。  
6. 回滚：env off 或 revert commit；无数据迁移。

## Open Questions（阶段 0 已锁定）

| # | 问题 | 锁定结论 |
|---|------|----------|
| Q1 | `task-notification` 是否可能只出现在 **下一用户 turn**？ | **P0：只认当前 turn stdout**。若实盘跨 turn，另开 change 做 session-scoped map |
| Q2 | StatusPanel 展示 active ids？ | **P0 不做**；仅 WorkingIndicator |
| Q3 | hard safety cap（如 24h）？ | **P0 不做**；依赖 Stop + EOF |
| Q4 | `turn:activity` vs Raw？ | **一等公民 `turn:activity`**（阶段 3） |
| Q5 | Grace re-arm 时钟？ | **D3b：清空后 full re-arm 5s**（禁止 remaining=0 秒杀） |
| Q6 | Codex / Grok 是否同修？ | **否**。见下「跨引擎对照」 |

## 跨引擎对照（为何 out of scope）

| 引擎 | 进程模型 | result 后 tree-kill？ | 与 #983 |
|------|----------|----------------------|---------|
| **Claude** | 每 turn 短进程 + `CLAUDE_POST_RESULT_GRACE` + `force_kill_process_group` | **有** | **本 change** |
| **Codex** | 长连接 app-server；`turn/completed` ≠ 杀进程 | **无** 同构路径 | 不纳入 |
| **Grok** | 每 turn 短进程，等 stdout EOF；仅 Stop kill | **无** post-result grace kill | 不纳入（若卡死另开防 hang） |
| Gemini / Kimi / OpenCode | 无 `CLAUDE_POST_RESULT_GRACE` | **无** | 不纳入 |

`force_kill_process_group` / `CLAUDE_POST_RESULT_GRACE` 仅存在于 `claude.rs`。

## WaitBgTasks 产品语义（已锁定）

- WaitBgTasks 期间 **不**发 `TurnCompleted` → UI 保持 working。
- 该 Claude turn **占用**会话发送位；P0 **不**支持并行再开同 session 新 turn。
- 用户可用 **Stop** 强制收敛。
- 切换/关闭 workspace 走既有 interrupt / runtime cleanup（允许 tree-kill）。

## Validation Strategy

### 自动化（合入门禁）

1. **纯函数**：id 抽取 / notification 终态判定 / grace gate 布尔矩阵。  
2. **fake Claude stream（全平台可跑）**：  
   - A：无 id + child 占 stdout → ≈5s settle + kill 路径  
   - B：有 id + sleep>5s → 5s 后进程仍逻辑存活（不 set settled_by_grace）  
   - C：matching completed → 释放后可 grace/EOF 收敛  
   - D：mismatched id → 不释放  
   - E：Stop 中断 WaitBgTasks  
3. **既有** `send_message_settles_turn_when_child_holds_stdout_open_after_result` 保持绿。  
4. FE：reducer turnId 精确映射 + WorkingIndicator label 单测。

### 人工（verification）

- Windows：真实 Claude Code 后台 sleep/测试套件 >5s，下一轮无 “No completion record” 误杀症状。  
- macOS：同上冒烟。  
- 无后台普通对话：settlement 体感与现网一致（无额外长等待）。

## 文件落点（实现时）

| 文件 | 职责 |
|------|------|
| `src-tauri/src/engine/claude_stream_helpers.rs` | extract backgroundTaskId / task notification terminal |
| `src-tauri/src/engine/claude.rs` | 状态机、grace gate、activity emit、clear |
| `src-tauri/src/engine/events.rs` | `TurnActivity`（若选 D4 一等公民） |
| `src-tauri/src/engine/claude/tests_*.rs` | 回归 |
| FE realtime reducer / messages working state | turn activity 绑定 |
| `WorkingIndicator` + i18n | 文案与计时 |
| `openspec/specs/claude-background-task-settlement/` | sync 后主 spec |
| `openspec/specs/claude-turn-settlement-stream-lifecycle/` | grace 条件 delta sync |

## 与既有 spec 的关系

- `claude-turn-settlement-stream-lifecycle`：保留 “result 后必须 bounded 收敛”，**收窄** tree-kill 前提。  
- 新 `claude-background-task-settlement`：blocker 生命周期与 waiting 投影。  
- 不修改 `conversation-lifecycle-contract` 的跨引擎删除/排序合同。
