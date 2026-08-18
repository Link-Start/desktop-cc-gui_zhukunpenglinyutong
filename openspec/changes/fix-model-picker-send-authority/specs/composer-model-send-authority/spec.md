## ADDED Requirements

### Requirement: Picker commit MUST write the same store send reads

用户在 Atomic / 底栏模型选择器提交一次模型或渠道选择后，下一轮 send 读取的模型身份 MUST 等于这次提交。Native overlay（`nativeAtomicSelection`）与 Shared `profileOverrides` MUST 只做瞬时勾选反馈，MUST NOT 单独构成「已切换」语义。

#### Scenario: Native same-profile model click updates send resolver

- **GIVEN** 当前是 Native 会话，同一 `providerProfileId`
- **WHEN** 用户在 Atomic 列表点选模型 M 并关闭菜单
- **THEN** `composerSelectionResolverRef` 的 id / runtime MUST 变为 M
- **AND** 下一轮 `modelForSend` MUST 为 M
- **AND** 系统 MUST NOT 只更新 overlay 而让 resolver 停留在旧模型

#### Scenario: Shared model click updates selectedNextTarget before send

- **GIVEN** 当前是 Shared Session
- **WHEN** 用户点选模型 M
- **THEN** `selectedNextTarget` MUST 在发送前写成完整 target，且 model 身份为 M
- **AND** 下一轮 Shared send MUST 只读这份 target
- **AND** MUST NOT 用全局 `selectedModelId` 覆盖 M

#### Scenario: Overlay is not a send source

- **WHEN** Native send 组装 `modelForSend`
- **THEN** 系统 MUST 读取 resolver / 线程 L2 binding
- **AND** MUST NOT 直接读取 `nativeAtomicSelection` 作为第二权威

### Requirement: Failed picker commit MUST roll back UI-only overrides

渠道或模型提交在无法写出完整 target 时（catalog 空、`keptModel` 缺失、续接取消），系统 MUST 回滚 overlay / `profileOverrides`，MUST NOT 留下「底栏已切、账本未切」的状态。

#### Scenario: Shared channel switch without keptModel rolls back override

- **GIVEN** Shared Atomic 正在切到另一渠道
- **AND** 目标 profile 没有可用 `keptModel`
- **WHEN** 提交路径无法调用 `onExecutionTargetChange`
- **THEN** `profileOverrides` MUST 恢复为切换前
- **AND** `selectedNextTarget` MUST 保持旧值
- **AND** 闭合态 MUST NOT 显示新渠道为已选

#### Scenario: Native continuation cancel clears overlay

- **GIVEN** Native 跨 managed profile 已弹出续接
- **WHEN** 用户取消续接
- **THEN** `nativeAtomicSelection` 与该引擎 `profileOverrides` MUST 被清除
- **AND** 下一轮 send MUST 仍使用原 L2 `providerProfileId` 与原模型

### Requirement: Explicit user-selected runtime MUST survive catalog miss

用户明确点选的 runtime 模型名，即使当时父层 catalog 尚未收录该 id，下一轮 send MUST 仍使用该 runtime。系统 MUST NOT 在同一提交 tick 用 catalog 默认或 residual repair 静默换回旧模型。

#### Scenario: Freeform runtime is sent as clicked

- **GIVEN** 用户点选 catalog 外的 runtime 名 R
- **WHEN** 下一轮 Native 或 Shared send
- **THEN** 发出的模型 MUST 为 R
- **AND** MUST NOT 被同 tick residual repair 换成 catalog 默认

#### Scenario: Foreign global selection does not override committed target

- **GIVEN** 本线程已提交 target M
- **AND** 全局 / 其他会话 `selectedModelId` 为 N
- **WHEN** 发送本线程
- **THEN** send MUST 使用 M
- **AND** MUST NOT 使用 N
