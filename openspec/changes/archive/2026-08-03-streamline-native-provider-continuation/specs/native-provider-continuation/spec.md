## ADDED Requirements

### Requirement: Provider Continuation Preview MUST Be Side-Effect-Bounded

系统 MUST 提供 idempotent prepare-only preview，在 target side effect 前冻结 artifacts 并返回 fidelity 与 token estimate。取消 preview MUST 丢弃匹配 request 的 prepared operation；共享 content-addressed artifact cache MAY 保留，但 MUST NOT 创建 target Session、发送 Context、修改 source history 或写 target catalog identity。

#### Scenario: preview returns decision metrics without target mutation

- **WHEN** 用户选择可用 destination Provider Profile
- **THEN** 系统 MUST 冻结并编译同一 operation 的 Context Package
- **AND** MUST 返回 source/package estimated tokens 与 fidelity
- **AND** MUST NOT 创建 target Native Session 或发送 Context

#### Scenario: canceled preview is discarded safely

- **WHEN** 用户在 prepare-only preview 后取消，或在异步 preview 完成前关闭 Dialog
- **THEN** 系统 MUST 只删除 checksum 匹配、phase 为 `prepared` 且无 result identity 的 operation
- **AND** MUST NOT 删除或修改已进入 `creating`、`ready` 或 `recovery-required` 的 operation

#### Scenario: confirmed execution reuses preview artifacts

- **WHEN** 用户确认已经 prepared 的 preview
- **THEN** execution MUST 复用同一 operation id、artifact refs 与 checksums
- **AND** MUST NOT 因 source history 后续增长而重新编译不同 Context

### Requirement: Provider Continuation Progress MUST Reflect Real Stages

Provider Continuation MUST 以 operation-scoped、低频 stage milestones 暴露 preparation、target delivery、verification 与 completion progress。Frontend MUST NOT 用 timer、polling 或 elapsed-time interpolation 伪造进度。

#### Scenario: local continuation reports stage progress

- **WHEN** prepare 或 execute 跨越实际 processing boundary
- **THEN** backend MUST emit 包含 workspace id、operation id、phase 与 phase percentage 的 progress event
- **AND** Dialog MUST 只消费当前 operation 的 event

#### Scenario: provider latency stalls one stage

- **WHEN** target Provider/API 长时间停留在 context delivery
- **THEN** progress MUST 保持在对应真实阶段
- **AND** MUST NOT 随 elapsed time 自动增长到 completion

### Requirement: Claude Continuation Bootstrap MUST Use A Minimal CLI Surface

Claude Provider Continuation bootstrap MUST 使用 continuation-only minimal command surface，禁用不参与 Context import 的 tools、skills、MCP、hooks、agents、auto-memory、thinking 与 prompt suggestions。普通 Claude turn MUST 保持现有 command surface。Minimal bootstrap MUST 保留 Provider auth/routing、model、stable target session identity、durable delivery evidence 与 explicit Provider/API rejection detection。

#### Scenario: continuation starts Claude target

- **WHEN** Claude target 执行 Context Package bootstrap
- **THEN** command MUST 启用 safe customization boundary、empty tools、disabled slash commands、disabled thinking 与 disabled prompt suggestions
- **AND** MUST 跳过 curated skill 与 AskUser MCP injection

#### Scenario: ordinary Claude turn starts

- **WHEN** 普通非-continuation Claude message 启动
- **THEN** minimal bootstrap flag MUST 默认为 false
- **AND** existing tools、skills、MCP、hooks 与 permission behavior MUST 保持不变

#### Scenario: target provider rejects bootstrap

- **WHEN** minimal bootstrap 后 target history 记录 structured Provider/API rejection
- **THEN** operation MUST 进入 existing `target-provider-rejected` recovery path
- **AND** MUST NOT 因 user-entry persistence 或 progress completion 进入 `ready`

## MODIFIED Requirements

### Requirement: Provider Continuation MUST Expose Fidelity And Failure

Reader omissions、Context Package degraded mode、unsupported 与 recovery state MUST 可诊断；需要 lossy projection 时 MUST 在 target side effect 前经过一次产品确认。正常确认 UI MUST 展示 token estimate 与 compact fidelity summary，MUST NOT 展示逐条 omissions、projection mode、adapter drop 或 raw protocol marker。

#### Scenario: lossy context is included in the unified confirmation

- **WHEN** prepared package 包含 `not-retrievable` omission、checkpoint degradation 或 adapter drop
- **THEN** UI MUST 在统一 Dialog 展示 source/package token estimate
- **AND** 同一次“继续”确认 MUST 同时授权 destination 与该 frozen package fidelity
- **AND** MUST NOT 再显示第二个 degradation confirmation
- **AND** 未确认前 MUST NOT 创建目标 Session 或发送 Context

#### Scenario: fidelity diagnostics remain available outside the primary UI

- **WHEN** degraded preparation 或 execution 需要诊断
- **THEN** backend response 与 logs MUST 保留 structured fidelity evidence
- **AND** primary Dialog MUST NOT 把 omissions list 或 raw technical mode 作为用户决策内容

### Requirement: Provider Continuation MUST Use Product-Controlled Confirmation

Provider Continuation MUST use a product-controlled, accessible dialog to prepare, preview and confirm the target and compact fidelity summary before creating target-side effects. The flow MUST NOT use browser or platform-native alert/confirm dialogs. Dialog MUST distinguish preparing, prepared confirmation, target delivery, verification, ready, and recoverable states; raw technical codes MUST NOT be the only user-facing explanation.

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

#### Scenario: native confirmation APIs remain unused

- **WHEN** the continuation requires confirmation or reports an error
- **THEN** the UI MUST render the state using application components
- **AND** MUST NOT invoke `window.alert`, `window.confirm`, Tauri `ask`, or Tauri `confirm`

### Requirement: Composer Provider Selection MUST Reuse Provider Continuation

Native Composer 从其他 Provider Profile 选择 Model 时 MUST 复用产品内 Provider Continuation Dialog 与现有 idempotent continuation operation；目标 snapshot MUST 包含用户选择的 Model。Sidebar context menu 与 Composer MUST 共享 prepare-only preview、一次确认、progress 与 recovery contract。

#### Scenario: cross-provider model opens continuation preview

- **WHEN** 用户在 Native Composer 选择与来源 binding 不同的可用 Provider Profile 与 Model
- **THEN** 系统 MUST 展示现有 Provider Continuation Dialog 并开始无 target-side-effect preparation
- **AND** Dialog MUST 展示来源 Session 与目标 CLI、Provider Profile、Model identity 和 estimated Context tokens
- **AND** 确认前 MUST NOT 创建目标 Session

#### Scenario: confirmation freezes selected model

- **WHEN** 用户确认由 Composer 发起的 Provider Continuation
- **THEN** continuation destination MUST 包含点击时选择的 Model
- **AND** 后续 picker 或 active engine 变化 MUST NOT 改写该 operation 的目标 snapshot

#### Scenario: cancellation preserves source session

- **WHEN** 用户取消由 Composer 发起的 Provider Continuation Dialog
- **THEN** 来源 Session、Provider binding 与 Model selection MUST 保持不变
- **AND** 系统 MUST 丢弃仍处于 prepared 且无 target identity 的 operation
- **AND** MUST NOT 创建目标 Session 或发送 Context

#### Scenario: context menu and composer share one preparation contract

- **WHEN** Provider Continuation 从 sidebar context menu 或 Native Composer 发起
- **THEN** 两个入口 MUST 使用相同的 source snapshot、operation idempotency 与 Dialog state preparation
- **AND** 两个入口 MUST 使用相同的一次确认、progress 与 recovery path
