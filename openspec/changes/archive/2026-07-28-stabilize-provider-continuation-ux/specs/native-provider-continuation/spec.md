## MODIFIED Requirements

### Requirement: Provider Continuation MUST Recover Idempotently

operation id、目标 Native identity 与 phase MUST durable；目标 side effect 后 transport evidence 不确定时，系统 MUST 先 probe，不得 blind retry。Provider continuation bootstrap MUST NOT 以模型精确复述 marker 作为唯一成功条件；目标 identity、冻结 artifact checksum 与 target history/runtime 的 durable delivery evidence MUST 构成 acceptance 判断。

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
