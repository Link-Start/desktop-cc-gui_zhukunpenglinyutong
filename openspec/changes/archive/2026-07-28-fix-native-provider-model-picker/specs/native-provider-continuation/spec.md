## ADDED Requirements

### Requirement: Composer Provider Selection MUST Reuse Provider Continuation

Native Composer 从其他 Provider Profile 选择 Model 时 MUST 复用产品内 Provider
Continuation Dialog 与现有 idempotent continuation operation；目标 snapshot MUST 包含
用户选择的 Model。

#### Scenario: cross-provider model opens continuation confirmation

- **WHEN** 用户在 Native Composer 选择与来源 binding 不同的可用 Provider Profile 与 Model
- **THEN** 系统 MUST 展示现有 Provider Continuation Dialog
- **AND** Dialog MUST 展示来源 Session 与目标 CLI、Provider Profile、Model identity
- **AND** 确认前 MUST NOT 创建目标 Session

#### Scenario: confirmation freezes selected model

- **WHEN** 用户确认由 Composer 发起的 Provider Continuation
- **THEN** continuation destination MUST 包含点击时选择的 Model
- **AND** 后续 picker 或 active engine 变化 MUST NOT 改写该 operation 的目标 snapshot

#### Scenario: cancellation preserves source session

- **WHEN** 用户取消由 Composer 发起的 Provider Continuation Dialog
- **THEN** 来源 Session、Provider binding 与 Model selection MUST 保持不变
- **AND** 系统 MUST NOT 创建目标 Session 或 operation side effect

#### Scenario: context menu and composer share one preparation contract

- **WHEN** Provider Continuation 从 sidebar context menu 或 Native Composer 发起
- **THEN** 两个入口 MUST 使用相同的 source snapshot、operation idempotency 与 Dialog state
  preparation
- **AND** 两个入口 MUST 使用相同的 degraded confirmation 与 recovery path
