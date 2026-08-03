## ADDED Requirements

### Requirement: Provider Continuation Dialog MUST Remain Dismissible During Target Delivery

Provider Continuation product Dialog MUST 允许用户在 target delivery / verification（frontend `running` stage）期间取消或关闭。取消 MUST 立即关闭 Dialog，MUST NOT 修改来源 Session 内容、Provider binding 或当前用户选中的线程。取消 MUST NOT 要求 backend hard-abort；in-flight create 可继续完成，但 Frontend MUST 将本次 operation 标记为 canceled，使 late success 不得接管 UI。

#### Scenario: user cancels while delivering context

- **WHEN** Dialog 处于 `running` 且 progress 显示传递或校验上下文
- **THEN** 底部取消控件 MUST 保持可交互
- **AND** 用户点击取消后 Dialog MUST 立即关闭
- **AND** 来源 Session 与当前选中线程 MUST 保持不变

#### Scenario: late create success after cancel is ignored

- **WHEN** 用户已在 `running` 中取消同一 `operationId`
- **AND** 随后 `createNativeProviderContinuation` 以 `ready` 与 result Session 返回
- **THEN** Frontend MUST NOT 自动选中该 result Session
- **AND** MUST NOT 为 destination 写入/激活 active Provider 记忆
- **AND** MUST NOT 重新打开该 Dialog

#### Scenario: late create failure after cancel is silent

- **WHEN** 用户已在 `running` 中取消同一 `operationId`
- **AND** 随后 create 失败或进入 recovery-required
- **THEN** Frontend MUST NOT 用该失败重新打开 Dialog
- **AND** 来源 Session MUST 保持不变

#### Scenario: cancel during preparing still discards prepared-only operation

- **WHEN** 用户在 prepare-only preview 完成前或 confirm 前取消
- **THEN** 系统 MUST 继续仅 discard phase=`prepared` 且无 result identity 的 operation
- **AND** MUST NOT 删除已进入 `creating`、`ready` 或 `recovery-required` 的 operation

## MODIFIED Requirements

### Requirement: Provider Continuation MUST Use Product-Controlled Confirmation

Provider Continuation MUST use a product-controlled, accessible dialog to prepare, preview and confirm the target and compact fidelity summary before creating target-side effects. The flow MUST NOT use browser or platform-native alert/confirm dialogs. Dialog MUST distinguish preparing, prepared confirmation, target delivery, verification, ready, and recoverable states; raw technical codes MUST NOT be the only user-facing explanation. Dialog dismiss / cancel MUST remain available during preparing, confirmation, target delivery (`running`), and recoverable error states.

#### Scenario: user previews a continuation target

- **WHEN** the user chooses an available destination Provider Profile
- **THEN** the system MUST present a Provider switch icon, readable source title, source, destination CLI, Provider Profile, selected Model and estimated Context tokens in a product-controlled dialog
- **AND** MUST show three compact stages for Context preparation, Provider startup, and verification/completion
- **AND** MUST NOT create the target Native Session until the user confirms

#### Scenario: preparation requires lossy projection

- **WHEN** prepare-only preview reports degraded fidelity
- **THEN** the same product-controlled dialog MUST keep the compact token summary
- **AND** MUST NOT render an omissions list, raw projection mode, adapter drop list, or a second degradation confirmation
- **AND** the single primary confirmation MUST execute the already frozen operation with degradation accepted

#### Scenario: recoverable target reports next action

- **WHEN** a target Session exists but bootstrap verification is temporarily unresolved
- **THEN** the dialog MUST explain that the source is unchanged and the target will not be recreated
- **AND** MUST offer a bounded re-probe or opening the known target when safe
- **AND** technical diagnostics MUST be secondary, copyable detail

#### Scenario: dismiss remains available during target delivery

- **WHEN** the dialog is delivering or verifying the target Session
- **THEN** the cancel/close control MUST remain enabled
- **AND** dismissing MUST abandon frontend takeover without mutating the source Session

#### Scenario: native confirmation APIs remain unused

- **WHEN** the continuation requires confirmation or reports an error
- **THEN** the UI MUST render the state using application components
- **AND** MUST NOT invoke `window.alert`, `window.confirm`, Tauri `ask`, or Tauri `confirm`
