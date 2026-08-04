## MODIFIED Requirements

### Requirement: Claude turn settlement MUST complete after result with bounded tail handling

当 Claude runtime 收到 terminal `result` event 后，turn SHALL 在 **适用条件下的** bounded grace/tail handling window 后完成结算，不能因为 stderr 或 process tail 无限停留在 generating state。

**适用条件（本 change 收窄）**：

- 当本 turn **不存在** active structured background-task blocker 时，result 后的 stdout EOF 等待 MUST 受 `CLAUDE_POST_RESULT_GRACE` 约束；超时后允许 process-group / process-tree termination 并成功结算。
- 当本 turn **存在** active structured background-task blocker 时，result 后 MUST NOT 仅因 grace 超时触发 process-tree termination；收敛改由 blocker 释放、provider EOF 或用户 Stop 驱动（详见 `claude-background-task-settlement`）。
- result 后 stderr drain MUST 保持 bounded timeout（`CLAUDE_POST_RESULT_STDERR_DRAIN`），不得无限阻塞 Finalize。

#### Scenario: result 后 stderr 仍有输出

- **WHEN** result 后 stderr 仍有输出
- **THEN** 当 Claude 发出 result 且 stderr 仍有 tail output 时，runtime 必须只在 bounded timeout 内 drain stderr，并在完成或超时后结算。

#### Scenario: settlement 后仍有残留进程

- **WHEN** settlement 后仍有残留进程
- **AND** 本 turn 无 active structured background-task blocker（或 blockers 已清空后进入 grace 路径）
- **THEN** 当 turn 已结算但 Claude process group 异常存活时，runtime 必须尝试 bounded cleanup 或 process-group termination，防止 stale process 维持 generating。

#### Scenario: grace tree-kill suppressed while structured blockers active

- **GIVEN** Claude 已发出 result
- **AND** 本 turn active structured background-task set 非空
- **WHEN** post-result 时间超过既有 grace window 且 stdout 未 EOF
- **THEN** runtime MUST NOT 因 grace 超时 force-kill process tree
- **AND** turn MUST 保持未完成，直到 blockers 清空后的 grace/EOF、provider EOF 或用户 Stop

#### Scenario: grace tree-kill remains for non-background pipe holders

- **GIVEN** Claude 已发出 result
- **AND** 本 turn 无 structured backgroundTaskId blocker
- **AND** MCP/Stop-hook 类子进程占用 stdout 导致未 EOF
- **WHEN** grace window 耗尽
- **THEN** runtime MUST 执行 bounded process-tree cleanup 并完成 turn settlement
- **AND** UI MUST NOT 永久停留在 generating

## ADDED Requirements

### Requirement: Post-result grace MUST be re-armed after blockers clear

若 result 已见且 structured blockers 从非空变为空，而 stdout 仍未 EOF，runtime MUST 重新应用既有 post-result grace 边界，而不是无限等待或跳过 anti-hang 防护。

#### Scenario: blockers clear then pipe still open

- **WHEN** 最后一个 structured blocker 被 matching terminal 释放
- **AND** stdout 尚未 EOF
- **THEN** runtime MUST 从清空时刻 **full re-arm** 完整 `CLAUDE_POST_RESULT_GRACE`（不得用 result 起算的剩余 0s）
- **AND** 仅在 re-arm 后的 grace 耗尽后才允许 force-kill process tree
