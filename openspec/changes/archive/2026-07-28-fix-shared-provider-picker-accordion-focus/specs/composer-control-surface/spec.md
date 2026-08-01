## MODIFIED Requirements

### Requirement: Provider Model Lists MUST Expand Mutually Exclusively

Composer Provider Profile 与 Model 列表 MUST 使用互斥折叠；同一 selector 中同一时间最多
展开一个 Provider Profile 的 Model 列表。Shared Session 在 nested CLI submenu 中切换
Provider Profile accordion 时，root selector 与当前 CLI submenu MUST 保持打开。

#### Scenario: opening another provider collapses the previous provider

- **WHEN** Provider A 的 Model 列表已展开，用户展开 Provider B
- **THEN** Provider B 的 Model 列表 MUST 展开
- **AND** Provider A 的 Model 列表 MUST 同步折叠

#### Scenario: expanded provider is keyboard operable

- **WHEN** keyboard 用户聚焦 Provider Profile trigger 并激活它
- **THEN** trigger MUST 切换该 Profile 的 expanded state
- **AND** MUST 暴露与可见状态一致的 `aria-expanded`

#### Scenario: shared nested provider toggle preserves menu focus scope

- **WHEN** 用户在 Shared Session 的 CLI submenu 中展开、切换或折叠 Provider Profile
- **THEN** root model selector MUST 保持打开
- **AND** 当前 CLI submenu MUST 保持打开
- **AND** 操作 MUST NOT 因 focus loss 被解释为 dismiss

#### Scenario: shared model selection remains terminal

- **WHEN** 用户在已展开的 Shared Provider Profile 下选择具体 Model
- **THEN** selector MUST 提交完整 `ExecutionTarget`
- **AND** selector MUST 按既有 terminal selection 行为关闭
