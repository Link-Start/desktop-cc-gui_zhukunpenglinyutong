## ADDED Requirements

### Requirement: Shared channel or model commit MUST write selectedNextTarget or make no UI change

Shared Session 下 Atomic 渠道切换与模型点选 MUST 以完整 `selectedNextTarget` 为唯一成功提交。系统 MUST NOT 在未写出完整 target 时保留 `profileOverrides` 作为已选渠道。V2 send 仍 MUST fail-closed：不完整 target 禁止发送。

#### Scenario: Channel switch writes a complete next target

- **WHEN** Shared 用户把渠道从 profile A 切到 profile B 且 B 有可用模型
- **THEN** 系统 MUST 立刻写出完整 `selectedNextTarget`（engine、providerProfileId=B、model 身份）
- **AND** 下一轮 send MUST 使用 B 的模型
- **AND** MUST NOT 只改底栏渠道芯片

#### Scenario: Channel switch without a model is a no-op

- **WHEN** Shared 用户点选渠道 B 但无法解析 `keptModel`
- **THEN** `selectedNextTarget` MUST 不变
- **AND** `profileOverrides` MUST NOT 停留在 B
- **AND** 闭合态渠道 / 模型展示 MUST 回到切换前的 target

#### Scenario: Send ignores leftover profileOverrides

- **GIVEN** 内存里残留着与 `selectedNextTarget` 不一致的 `profileOverrides`
- **WHEN** Shared send 组装下一轮执行目标
- **THEN** 系统 MUST 只读 `selectedNextTarget`
- **AND** MUST NOT 用 override 拼出发送模型
