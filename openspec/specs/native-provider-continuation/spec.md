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
Its interactive header MUST remain fully visible and operable while collapsed or expanded, MUST account for the shared Canvas topbar safe offset, and MUST NOT be clipped behind Canvas chrome during the toggle interaction. Source navigation MUST use a compact icon-only action without visible button text or resting button chrome while preserving an accessible name, tooltip, keyboard interaction, and disabled semantics.
When source messages are already available in the client, expanded metadata MUST expose a compact deterministic excerpt of the source Session's latest readable turn without rendering a second Messages Canvas or triggering implicit history loading.

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
- **AND** the source excerpt MUST use an unavailable fallback rather than stale or fabricated content

#### Scenario: continuation metadata is toggled near the Canvas header

- **WHEN** the compact metadata row is collapsed or the user expands it while Messages is anchored near an edge
- **THEN** the row header MUST remain fully visible below the shared Canvas topbar and above message content
- **AND** the user MUST be able to activate the same header again to restore the collapsed state

#### Scenario: source navigation is presented in expanded metadata

- **WHEN** the continuation metadata row is expanded and its source navigation is available
- **THEN** the navigation action MUST render as an icon without visible text, border, or resting background
- **AND** it MUST preserve an accessible name, tooltip, keyboard activation, and a visible hover or focus state

#### Scenario: latest source turn is already loaded

- **WHEN** the source Session has loaded readable message items
- **THEN** expanded metadata MUST show the last non-empty user message and the latest non-empty assistant message after it
- **AND** trailing tool, reasoning, plan, or other non-message items MUST NOT change the selected excerpt
- **AND** long text MUST remain visually bounded while full source navigation remains available

#### Scenario: latest source turn is incomplete

- **WHEN** the source Session has a last non-empty user message without a following readable assistant message
- **THEN** expanded metadata MUST show the available user excerpt without fabricating an assistant response

#### Scenario: source messages are not loaded

- **WHEN** the source Session identity is available but its message items are absent or contain no readable text
- **THEN** expanded metadata MUST show an explicit not-loaded or empty fallback
- **AND** opening the metadata MUST NOT trigger implicit history loading

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

### Requirement: Provider Continuation MUST Freeze Runtime Model Identity

Provider Continuation 从 Provider-scoped catalog 选择模型时，destination MUST 将 catalog
entry identity 与 CLI runtime model 分开冻结。CLI invocation MUST 使用 runtime model；
catalog entry id MUST NOT 作为 runtime model 发送。

#### Scenario: catalog id differs from runtime model

- **WHEN** 用户选择的 catalog entry `id` 为 `settings-reasoning` 且 runtime `model` 为
  `deepseek-v4-pro`
- **THEN** continuation destination MUST 冻结两种 identity
- **AND** Claude CLI MUST 接收 `deepseek-v4-pro`
- **AND** MUST NOT 接收 `settings-reasoning`

#### Scenario: backend receives a proven UI-only model id

- **WHEN** Claude continuation payload 的 model 命中 Provider-scoped catalog entry id，且该
  entry 的 runtime model 不同
- **THEN** backend MUST 在 target identity 或 target-side effect 创建前返回
  `invalid-target-model`
- **AND** MUST NOT 静默把该 UI-only id 发送给 Claude CLI

#### Scenario: custom model is not present in catalog

- **WHEN** continuation payload 包含通过 shape validation 的 non-empty custom runtime model，
  且它不命中 catalog entry id
- **THEN** backend MUST 保留既有 custom model passthrough
- **AND** MUST NOT 引入 official-model allowlist

### Requirement: Provider Continuation Recovery MUST Prefer Explicit Rejection

Claude continuation recovery MUST 将当前 bootstrap 之后的结构化 Provider/API rejection
视为强负 evidence。Explicit rejection MUST 优先于 bootstrap user-entry、acceptance marker、
process error 与无关 stderr warning。

#### Scenario: bootstrap entry is followed by API rejection

- **WHEN** 同一 target history 含当前 package 的完整 bootstrap user entry，且其后 assistant
  entry 带 `isApiErrorMessage=true` 或 `apiErrorStatus`
- **THEN** operation MUST 记录 `target-provider-rejected`
- **AND** MUST NOT 进入 `ready`
- **AND** retry MUST probe 同一 target identity，MUST NOT 创建第二个 target

#### Scenario: source context mentions an old API error

- **WHEN** bootstrap user entry 的 Context Package 文本提及旧 `API Error`，但当前
  bootstrap 后没有结构化 rejection
- **THEN** recovery MUST NOT 把来源文本当成当前 target rejection

#### Scenario: process error conflicts with durable target rejection

- **WHEN** Claude process 返回 connector warning 或其他 runtime error，且 target history
  已持久化结构化 API rejection
- **THEN** user-facing technical detail MUST 以 target Provider/API rejection 为主
- **AND** warning MUST NOT 覆盖该根因
