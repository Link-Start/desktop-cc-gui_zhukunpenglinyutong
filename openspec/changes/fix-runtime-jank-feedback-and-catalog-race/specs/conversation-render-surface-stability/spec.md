## ADDED Requirements

### Requirement: Growing Assistant Snapshots MUST Preserve Live-Text Render Isolation

Active non-terminal assistant item 的纯正文增长 snapshot MUST 复用 transient live-text channel，不得仅因正文增长持续改写 root conversation item array。

#### Scenario: Active assistant snapshot only grows body text

- **WHEN** 同一个 active assistant item 收到 non-terminal snapshot
- **AND** snapshot 变化仅为正文单调增长
- **THEN** 最新正文 MUST 通过 live assistant text channel 对 active row 可见
- **AND** stable Timeline presentation input MUST NOT 因该纯正文增长被替换

#### Scenario: Snapshot changes durable structure

- **WHEN** assistant snapshot 改变 item identity、结构 metadata、tool boundary、reasoning boundary 或其他 durable semantics
- **THEN** 该变化 MUST 进入 durable conversation state
- **AND** transient text optimization MUST NOT 丢弃或重排结构事件

#### Scenario: Streaming item completes

- **WHEN** 使用 transient channel 的 assistant item 收到 terminal 或 final snapshot
- **THEN** durable transcript MUST 收敛到完整最终正文
- **AND** final Markdown、history restore 与 thread switching MUST 无需依赖 transient channel
