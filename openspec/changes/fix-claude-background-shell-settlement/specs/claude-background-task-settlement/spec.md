## ADDED Requirements

### Requirement: Structured backgroundTaskId is the only settlement blocker identity

Claude Local CLI settlement MUST treat a background shell/task as a process-tree kill blocker only when the same turn's stream carries a structured non-empty `backgroundTaskId`（兼容 `background_task_id`）。系统 MUST NOT 根据工具输出正文、assistant 散文或 “background/shell/task/后台” 等关键词猜测任务存活。

#### Scenario: tool result registers structured id

- **GIVEN** Claude stream 在同一 turn 内产生 tool_result（或等价 user tool_result 事件）
- **AND** payload 含 `toolUseResult.backgroundTaskId = "bg-1"`（或 snake_case 等价字段）
- **WHEN** runtime 处理该事件
- **THEN** runtime MUST 将 `"bg-1"` 加入当前 turn 的 active background-task set
- **AND** 重复登记同一 id MUST 保持幂等

#### Scenario: prose mentioning background does not register

- **GIVEN** stream 文本或 tool 输出仅包含自然语言 “running in background” 且无 structured backgroundTaskId
- **WHEN** runtime 处理该事件
- **THEN** active set MUST NOT 增加条目
- **AND** result 后的 grace tree-kill 路径 MUST 仍可按无 blocker 规则触发

#### Scenario: empty or whitespace id is ignored

- **WHEN** structured 字段存在但为空串或仅空白
- **THEN** runtime MUST 忽略该字段，不写入 active set

#### Scenario: id budget protects memory

- **WHEN** 单 turn 内 structured id 数量或单 id 长度超过实现上限（设计默认：set ≤64，id ≤128 chars）
- **THEN** runtime MUST 拒绝超额登记并记录 warn
- **AND** MUST NOT panic 或阻塞读循环

### Requirement: Active structured blockers MUST suppress post-result grace process-tree kill

当当前 turn 的 active background-task set 非空时，即便已见到 terminal assistant `result`，runtime MUST NOT 因 `CLAUDE_POST_RESULT_GRACE` 超时而对 Claude process tree 执行 force kill（Unix process-group kill / Windows `taskkill /T`）。

#### Scenario: background task outlives five-second grace

- **GIVEN** 本 turn 已登记至少一个 structured backgroundTaskId
- **AND** stream 已发出 type=`result`
- **AND** 后台任务与 provider 进程在 result 后仍存活超过 5 秒
- **WHEN** grace 时钟到达 5 秒
- **THEN** runtime MUST NOT 设置 grace-settled force kill
- **AND** MUST 继续等待 matching terminal 释放、provider EOF 或用户 Stop

#### Scenario: no blockers keeps existing grace kill

- **GIVEN** 本 turn 从未登记任何 structured backgroundTaskId
- **AND** result 后 stdout 因子进程占管道未 EOF
- **WHEN** grace 耗尽
- **THEN** runtime MUST 允许既有 force_kill_process_group 路径收敛 turn
- **AND** MUST 将 grace kill 的 exit status 按既有成功结算规则处理（不误报失败）

### Requirement: Matching terminal task notification releases blockers

Runtime MUST 仅在观察到 **task-id 精确匹配** 且 status 为终态时，从 active set 移除对应 id。

#### Scenario: matching completed releases one id

- **GIVEN** active set 含 `"bg-1"`
- **WHEN** 同 turn stream 出现可解析的 task notification，`task-id=bg-1` 且 `status=completed`（大小写不敏感）
- **THEN** runtime MUST 从 active set 移除 `"bg-1"`

#### Scenario: failed and stopped are terminal

- **WHEN** matching notification 的 status 为 `failed` 或 `stopped`
- **THEN** runtime MUST 同样释放该 id

#### Scenario: mismatched id does not release

- **GIVEN** active set 仅含 `"bg-1"`
- **WHEN** notification 的 task-id 为 `"bg-other"` 或无法解析
- **THEN** active set MUST 保持含 `"bg-1"`

#### Scenario: non-terminal status does not release

- **WHEN** matching task-id 的 status 为 `running` 或未知值
- **THEN** runtime MUST NOT 释放该 id

### Requirement: Blocker clearance restores bounded grace if pipes still open

当 active set 变为空、且 assistant `result` 已见、但 stdout 仍未 EOF 时，runtime MUST 重新进入既有 bounded grace 等待，而不是无限 hang，也不是立即无条件 kill。

#### Scenario: last blocker released while pipe open

- **GIVEN** result 已见且 active set 从非空变为空
- **AND** stdout 仍可读（未 EOF）
- **AND** 此前 WaitBgTasks 已持续超过原 grace 窗口（例如 60s）
- **WHEN** runtime 选择下一步等待策略
- **THEN** MUST 从 **清空时刻** 起重新给予完整 `CLAUDE_POST_RESULT_GRACE`（full re-arm）
- **AND** MUST NOT 因 `result_seen_at` 早已超过 5s 而立即 force kill
- **AND** 仅在 re-arm 后的 grace 耗尽后才允许 force kill tree

#### Scenario: late structured id after result suppresses grace kill

- **GIVEN** result 已见且当时 active set 为空，grace 正在计时
- **WHEN** 随后 stream 登记到 structured `backgroundTaskId`
- **THEN** runtime MUST 进入 WaitBgTasks
- **AND** MUST NOT 在 blockers 仍非空时因 grace 超时 force-kill

#### Scenario: provider EOF with remaining blockers

- **GIVEN** active set 仍非空
- **WHEN** provider stdout EOF（进程退出）
- **THEN** runtime MUST 结束 WaitBgTasks 并走 Finalize（按 exit status 既有规则）
- **AND** MUST NOT 再对已退出进程空转 grace

### Requirement: User Stop always forces settlement

用户显式 Stop/interrupt MUST 在任意 settlement 阶段强制收敛：允许 process-tree kill，清空 active set 与 waiting 投影，并以 stop/error 语义结束 turn。

#### Scenario: stop during WaitBgTasks

- **GIVEN** turn 处于有 active blockers 的 waiting 阶段
- **WHEN** 用户触发 Stop
- **THEN** runtime MUST 终止 Claude process tree（平台既有 terminate/force kill 路径）
- **AND** MUST 清空 active set
- **AND** MUST 发出可清理前端 waiting 态的 terminal 事件（TurnError 或等价 stop）

### Requirement: Waiting state projection is turn-scoped and low-churn

当 turn 因 structured blockers 停留在 WaitBgTasks 时，runtime MUST 通过带精确 `workspaceId + turnId` 的 realtime activity 事件投影 waiting 状态；前端 MUST 仅绑定匹配的 live turn，并在 terminal / 新 turn 清理临时态。投影 MUST NOT 引入 root-level 秒级轮询或逐 token 状态更新。

#### Scenario: enter waiting after result with blockers

- **GIVEN** result 已见且 active set 非空
- **WHEN** runtime 进入 WaitBgTasks
- **THEN** 系统 MUST 发出 phase=`waiting_background_tasks`（或等价）activity 事件，携带 turnId 与 activeCount/ids
- **AND** UI MUST 保持 working/thinking，并展示可理解的等待 Shell/后台任务文案
- **AND** 已用时间 MUST 延续本 turn 起点，不因进入 waiting 重置

#### Scenario: ignore activity for other turns

- **WHEN** activity 事件的 turnId 与当前 live turn 不一致
- **THEN** 前端 MUST 忽略该事件，不得覆盖当前会话 waiting 投影

#### Scenario: clear on terminal

- **WHEN** 同 turn 发出 TurnCompleted 或 TurnError
- **THEN** 前端 MUST 清除 waiting_background_tasks 临时态
- **AND** WorkingIndicator 不得在 idle 后继续显示等待文案

### Requirement: Cross-platform decision parity

Structured blocker 判定、grace 门闩、释放规则 MUST 在 macOS、Linux、Windows 上行为一致。平台差异仅允许存在于 process terminate 原语实现，不得存在“仅某平台延后 kill / 仅某平台忽略 blocker”的平行策略。

#### Scenario: same gate on all platforms

- **GIVEN** 相同的 stream 事件序列（含 backgroundTaskId 与 result）
- **WHEN** 在任一支持平台执行 settlement 决策
- **THEN** 是否允许 grace force kill 的布尔结果 MUST 相同
