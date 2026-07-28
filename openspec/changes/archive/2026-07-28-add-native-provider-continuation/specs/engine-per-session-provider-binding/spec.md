## ADDED Requirements

### Requirement: Provider Continuation MUST Own A New Provider Binding

Provider Continuation 的目标 Session MUST 持久化用户选择的 Engine + Provider Profile
binding；该 binding 与来源 Session 独立，Provider 不可用时 MUST fail closed。

#### Scenario: destination binding differs from source

- **WHEN** Provider A 来源成功续接到 Provider B
- **THEN** 新 Session binding MUST 指向 Provider B
- **AND** 来源 Session binding MUST 保持 Provider A

#### Scenario: destination provider disappears

- **WHEN** prepared operation 指向的 managed Provider 在 execute 前不可用
- **THEN** operation MUST 保留 prepared/retry state
- **AND** MUST NOT 回退到 local/default 或来源 Provider
