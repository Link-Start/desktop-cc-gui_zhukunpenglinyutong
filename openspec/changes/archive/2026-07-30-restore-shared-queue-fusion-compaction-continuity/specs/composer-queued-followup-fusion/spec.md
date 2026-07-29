## MODIFIED Requirements

### Requirement: Queued Follow-up Fusion SHALL Prefer Existing In-Run Follow-up Semantics

系统 MUST 在 queue fusion 真正收到 continuation 证据前，将该动作视为“待确认接续”，而不是直接向用户宣称回复已经继续生成。只有 runtime-probed `input.mid-turn=supported` 才能使用 same-run steer；`compat-input` MUST 使用 explicit cutover，`unsupported` MUST 保留为普通 follow-up。

#### Scenario: same-run fusion remains pending until new continuation evidence arrives

- **GIVEN** 当前线程正在运行
- **AND** 当前引擎报告 `input.mid-turn=supported`
- **WHEN** 用户点击某条排队消息的 `融合`
- **THEN** 系统 MAY 先进入待确认接续状态并使用 native steer
- **AND** 在收到新的 `turn/started`、stream delta、execution item 或等效 continuation 证据前 MUST NOT 直接宣称“内容正在继续生成”

#### Scenario: compat-input fusion waits for safe successor

- **GIVEN** 当前线程正在运行
- **AND** 当前引擎报告 `input.mid-turn=compat-input`
- **WHEN** 用户点击某条排队消息的 `融合`
- **THEN** 系统 MUST interrupt exact predecessor owner 并等待其 terminal settlement
- **AND** 系统 MUST 使用原 queue payload 与 frozen Target 创建 successor
- **AND** successor run 未真实启动前 MUST NOT 把 cutover 视为成功继续

#### Scenario: unsupported input remains follow-up

- **WHEN** 当前引擎报告 `input.mid-turn=unsupported`
- **THEN** 系统 MUST NOT 调用 native steer 或伪造 cutover capability
- **AND** queue item MUST 保持普通 follow-up 并等待 predecessor settlement

## ADDED Requirements

### Requirement: Shared Queue Drain SHALL Require Typed Durable Acceptance

Shared queue drain MUST keep an item recoverable until the V2 send path returns a matching typed accepted result with canonical commit confirmation.

#### Scenario: Shared dispatch is blocked

- **WHEN** queue drain receives `blocked`, `target-unavailable`, `recovery-required`, or an ambiguous error
- **THEN** the original queue item MUST remain recoverable with its original order and payload
- **AND** the UI MUST NOT claim that it was sent

#### Scenario: Shared dispatch commits

- **WHEN** queue drain receives matching `status=accepted` and `v2.committed=true`
- **THEN** the item MAY be removed exactly once
- **AND** duplicate settlement or React effect execution MUST NOT dispatch it again
