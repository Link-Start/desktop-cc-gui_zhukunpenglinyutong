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

- **WHEN** operation 已进入 `creating`、`ready` 或 `recovery-required` 后 artifact 缺失或 checksum 不匹配
- **THEN** operation MUST 进入 explicit `recovery-required`
- **AND** MUST NOT 重读来源或创建第二个目标 Session

#### Scenario: stale prepared artifact is repaired before side effects

- **WHEN** a legacy or corrupted artifact belongs to a `prepared` operation with no result Session
- **THEN** the system MUST delete only that prepared operation and rebuild from the same validated request
- **AND** operations at `creating`, `ready`, or `recovery-required` MUST NOT use this repair path

### Requirement: Provider Continuation MUST Recover Idempotently

operation id、目标 Native identity 与 phase MUST durable；目标 side effect 后 transport
evidence 不确定时，系统 MUST 先 probe，不得 blind retry。Provider continuation bootstrap
MUST NOT 以模型精确复述 marker 作为唯一成功条件；目标 identity、冻结 artifact checksum
与 target history/runtime 的 durable delivery evidence MUST 构成 acceptance 判断。

#### Scenario: crash after target creation

- **WHEN** App 在目标 Native Session 已创建但 metadata commit 前崩溃
- **THEN** 重启后 MUST 依据 durable operation/result identity probe
- **AND** MUST NOT 自动创建第二个 Native Session

#### Scenario: model does not echo marker

- **WHEN** target Session 已创建且完整 bootstrap entry 已在对应 target history/runtime evidence 中持久化，但模型没有精确回复 acceptance marker
- **THEN** operation MUST 依据 durable transport evidence 进入 `ready`
- **AND** MUST NOT 把模型服从性失败报告为 target 创建失败

#### Scenario: target exists but delivery evidence is temporarily unreadable

- **WHEN** target identity 已持久化但 bounded probe 暂时无法确认 bootstrap delivery
- **THEN** operation MUST 进入 `recovery-required`
- **AND** retry MUST probe 同一 target identity 而不是创建第二个 Session

### Requirement: Provider Continuation MUST Expose Fidelity And Failure

Reader omissions、Context Package degraded mode、unsupported 与 recovery state MUST 对用户
可见；需要 lossy projection 时 MUST 经过显式确认。

#### Scenario: lossy context requires confirmation

- **WHEN** prepared package 包含 `not-retrievable` omission 或 checkpoint degradation
- **THEN** UI MUST 展示 mode、omissions 与 token estimate
- **AND** 未确认前 MUST NOT 创建目标 Session 或发送 Context

### Requirement: Codex Import Capability MUST Be Probed

Codex continuation MUST probe `thread/inject_items` support without creating or mutating the target
Session. Only a JSON-RPC method-not-found response proves unsupported capability.

#### Scenario: Codex import is unavailable

- **WHEN** the probe returns JSON-RPC method not found
- **THEN** the continuation MUST use its declared portable prompt transport
- **AND** it MUST NOT call `thread/inject_items` after classifying the method unsupported

### Requirement: Provider Continuation MUST Use Product-Controlled Confirmation

Provider Continuation MUST use a product-controlled, accessible dialog to preview and confirm the target and any degradation before creating target-side effects. The flow MUST NOT use browser or platform-native alert/confirm dialogs. Dialog MUST distinguish creating, verifying, ready, and recoverable states; raw technical codes MUST NOT be the only user-facing explanation.

#### Scenario: user previews a continuation target

- **WHEN** the user chooses an available destination Provider Profile
- **THEN** the system MUST present the source, destination CLI, and Provider Profile in a product-controlled dialog
- **AND** MUST NOT create the target Native Session until the user confirms

#### Scenario: compilation requires degraded confirmation

- **WHEN** the first confirmation produces `confirmation-required`
- **THEN** the same product-controlled dialog MUST present mode, omissions, token estimate, and adapter drops
- **AND** the system MUST NOT create the target Native Session until the user explicitly accepts that degradation

#### Scenario: recoverable target reports next action

- **WHEN** a target Session exists but bootstrap verification is temporarily unresolved
- **THEN** the dialog MUST explain that the source is unchanged and the target will not be recreated
- **AND** MUST offer a bounded re-probe or opening the known target when safe
- **AND** technical diagnostics MUST be secondary, copyable detail

#### Scenario: native confirmation APIs remain unused

- **WHEN** the continuation requires confirmation or reports an error
- **THEN** the UI MUST render the state using application components
- **AND** MUST NOT invoke `window.alert`, `window.confirm`, Tauri `ask`, or Tauri `confirm`

### Requirement: Provider Continuation Capability Boundaries MUST Be Visible

The destination picker MUST expose registered CLIs and Provider Profiles with their verified continuation-target capability state. An engine verified only as a source MUST remain disabled as a destination with a human-readable reason.

#### Scenario: Kimi is source-only

- **WHEN** Kimi is registered but continuation target acceptance has not been verified
- **THEN** the destination picker MUST keep Kimi visible but disabled
- **AND** MUST explain that Kimi can be a source while target continuation is not yet available

### Requirement: Provider Continuation MUST Expose Readable Identity And Source Navigation

A ready Provider Continuation MUST have a human-readable title and a discoverable relationship to its source Session. The relationship projection MUST be a compact, collapsible metadata row inside the existing message scroll flow and MUST NOT alter ordinary message grouping, streaming, completion, or scroll-anchor semantics.

#### Scenario: continuation becomes ready

- **WHEN** a Provider Continuation target Session reaches ready
- **THEN** its sidebar/canvas identity MUST use a readable title instead of a protocol marker
- **AND** the canvas MUST expose source and target snapshots in a compact row that is collapsed by default
- **AND** the user MUST be able to open the source Session when it is still available

#### Scenario: continuation metadata is absent

- **WHEN** a Native Session is not a Provider Continuation or its metadata row is not rendered
- **THEN** the ordinary Messages DOM order, grouping, final separator, processing completion, and scroll-anchor behavior MUST remain unchanged

#### Scenario: source session is unavailable

- **WHEN** the recorded source Session no longer exists or is inaccessible
- **THEN** the continuation identity MUST remain readable from frozen snapshots
- **AND** source navigation MUST be disabled with an explicit explanation
