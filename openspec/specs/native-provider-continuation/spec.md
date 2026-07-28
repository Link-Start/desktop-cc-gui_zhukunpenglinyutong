# native-provider-continuation Specification

## Purpose

定义 Native Session 跨 Provider 续接的冻结、创建、恢复和用户可见失败契约；目标是创建独立的新 Native Session，同时完整保留来源。

## Requirements

### Requirement: Provider Continuation MUST Create A New Native Session

用户选择“使用其他 Provider 继续”时，系统 MUST 冻结来源 Target Snapshot，创建新的 Native
Session 与目标 Provider Binding，并保持来源 Session 不变。

#### Scenario: cross-provider continuation succeeds

- **WHEN** 用户从 Provider A 的 Native Session 选择可用 Provider B
- **THEN** 系统 MUST 创建新的 Provider B Native Session
- **AND** MUST NOT 删除、修改、归档或重新绑定来源 Session

#### Scenario: same provider is not a provider continuation

- **WHEN** 用户选择与来源相同的 Engine 与 Provider Profile
- **THEN** UI MUST 阻止 Provider Continuation 创建
- **AND** MAY 引导用户使用既有 continue/fork 能力

### Requirement: Provider Continuation MUST Prepare Before Target Side Effects

系统 MUST 在创建目标 Native Session 或发送 Context 前，持久化 immutable normalized
entries artifact、ContextPackage artifact 与 `NativeHistoryMaterialization`。

#### Scenario: retry reuses frozen artifacts

- **WHEN** prepared operation 因目标 unavailable 而重试，且来源 history 已增长或删除
- **THEN** retry MUST 校验并复用原 artifact refs/checksums
- **AND** MUST NOT 重读来源生成不同 Context

#### Scenario: artifact integrity fails

- **WHEN** prepared operation 的 artifact 缺失或 checksum 不匹配
- **THEN** operation MUST 进入 explicit `recovery-required`
- **AND** MUST NOT 重读来源或创建第二个目标 Session

### Requirement: Provider Continuation MUST Recover Idempotently

operation id、目标 Native identity 与 phase MUST durable；目标 side effect 后 ACK 不确定时，
系统 MUST 先 probe，不得 blind retry。

#### Scenario: crash after target creation

- **WHEN** App 在目标 Native Session 已创建但 metadata commit 前崩溃
- **THEN** 重启后 MUST 依据 durable operation/result identity probe
- **AND** MUST NOT 自动创建第二个 Native Session

### Requirement: Provider Continuation MUST Expose Fidelity And Failure

Reader omissions、Context Package degraded mode、unsupported 与 recovery state MUST 对用户
可见；需要 lossy projection 时 MUST 经过显式确认。

#### Scenario: lossy context requires confirmation

- **WHEN** prepared package 包含 `not-retrievable` omission 或 checkpoint degradation
- **THEN** UI MUST 展示 mode、omissions 与 token estimate
- **AND** 未确认前 MUST NOT 创建目标 Session 或发送 Context
