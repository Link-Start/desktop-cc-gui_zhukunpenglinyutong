# Spec Delta: claude-turn-settlement-stream-lifecycle

## ADDED Requirements

### Requirement: Claude turn settlement MUST complete after result with bounded tail handling

当 Claude runtime 收到 terminal `result` event 后，turn SHALL 在 bounded grace/tail handling window 后完成结算，不能因为 stderr 或 process tail 无限停留在 generating state。

#### Scenario: result 后 stderr 仍有输出

- **WHEN** result 后 stderr 仍有输出
- **THEN** 当 Claude 发出 result 且 stderr 仍有 tail output 时，runtime 必须只在 bounded timeout 内 drain stderr，并在完成或超时后结算。

#### Scenario: settlement 后仍有残留进程

- **WHEN** settlement 后仍有残留进程
- **THEN** 当 turn 已结算但 Claude process group 异常存活时，runtime 必须尝试 bounded cleanup 或 process-group termination，防止 stale process 维持 generating。

### Requirement: Claude usage probing MUST NOT use /context in the hot turn path

Claude runtime usage/context handling SHALL 避免在 main turn lifecycle 中发送 `/context` command probe。

#### Scenario: Claude 回合完成

- **WHEN** Claude 回合完成
- **THEN** 当 runtime finalize Claude turn 时，不得把 `/context` command 作为正常 settlement 的一部分。
