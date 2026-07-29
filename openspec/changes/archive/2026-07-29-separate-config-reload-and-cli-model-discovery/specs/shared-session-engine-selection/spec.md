## ADDED Requirements

### Requirement: Shared Target Picker MUST Refresh The Expanded Binding

Shared Session Target Picker 的 catalog action MUST 作用于用户当前展开的 `CLI + Provider Profile`，不得从 active thread 或 global engine selection 猜测目标。

#### Scenario: Refresh a non-active Provider
- **WHEN** Shared Session 当前绑定 Provider A
- **AND** 用户展开 Provider B 并执行 config reload 或 CLI discovery
- **THEN** 请求 MUST 携带 Provider B identity
- **AND** Provider B 模型框 MUST 使用刷新结果
- **AND** Provider A target snapshot MUST 保持不变

#### Scenario: Select discovered model
- **WHEN** Shared Picker 的 Provider B discovery 返回新模型
- **AND** 用户选择该模型
- **THEN** `selectedNextTarget` MUST 原子保存 Provider B identity、catalog entry id 与 runtime model
- **AND** send boundary MUST 继续使用冻结后的 runtime model

#### Scenario: One binding fails
- **WHEN** Shared Picker 中某一 binding 刷新失败
- **THEN** 其他 CLI/Profile catalog MUST 保持可用
- **AND** 整个 Shared Picker MUST NOT 被清空或关闭
