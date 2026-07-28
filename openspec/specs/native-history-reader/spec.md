# native-history-reader Specification

## Purpose

定义 Claude session JSONL、Codex rollout 与其他 Native Session 历史的统一只读读取边界，确保续接只消费可冻结、可追溯且不会污染来源的数据。

## Requirements

### Requirement: Native History Reader MUST Expose A Stable Read Boundary

系统 MUST 为 Claude session JSONL、Codex rollout 与 Kimi public history surface 提供统一
只读 probe/read contract，并仅在 `stableCursor=true` 且存在 `currentThroughCursor` 时允许
Provider Continuation。

#### Scenario: stable source can be read to the probed boundary

- **WHEN** Reader probe 得到 stable cursor 且来源在该边界前保持不变
- **THEN** read MUST 只返回该 cursor 覆盖的完整 entries
- **AND** 后续 append MUST NOT 改变本次读取结果

#### Scenario: unstable source fails closed

- **WHEN** Reader 无法证明 stable cursor 或没有 current through cursor
- **THEN** 系统 MUST 返回 typed `unsupported-stable-cursor`
- **AND** MUST NOT 创建目标 Session 或写入 prepared materialization

### Requirement: Native History Reader MUST Preserve Order Provenance And Fidelity

Reader MUST 输出 ordered canonical-shaped `ContextSourceEntry`，保留 source entry identity、
role、Tool Call/Result pairing、engine/provider/native session provenance 与 fidelity；无法
保真的内容 MUST 进入 typed omissions。

#### Scenario: tool exchange remains atomic

- **WHEN** 来源包含完整 Tool Call 与对应 Tool Result
- **THEN** Reader MUST 保持配对与 source order
- **AND** ContextCompiler MUST 成对保留或成对省略

#### Scenario: private or malformed content is not fabricated

- **WHEN** vendor entry 无法安全转换、损坏或包含不可导出的 private block
- **THEN** Reader MUST 记录 omission 或返回 typed error
- **AND** MUST NOT 伪造 Tool ID、Reasoning Signature 或完整 fidelity

### Requirement: Native History Reader MUST Be Read Only

Reader MUST NOT 修改、复制或迁移 vendor history，也 MUST NOT 把输出写入 Shared Canonical
Event Log。

#### Scenario: continuation reads a native source

- **WHEN** Provider Continuation 从 Native Session 编译 Context
- **THEN** vendor history bytes MUST 保持不变
- **AND** Shared Event Log MUST NOT 新增来源 history facts

### Requirement: Native History Reader MUST Return Typed Source Errors

来源不存在、权限不足、格式损坏、版本不支持、probe/read 间边界内容漂移 MUST 返回可区分
typed error。

#### Scenario: source changes before bounded read completes

- **WHEN** probe 后来源在 frozen boundary 内发生改写或截断
- **THEN** Reader MUST 返回 `source-drifted`
- **AND** MUST NOT 用最新 UI transcript 或重新 probe 的结果假装同一 operation
