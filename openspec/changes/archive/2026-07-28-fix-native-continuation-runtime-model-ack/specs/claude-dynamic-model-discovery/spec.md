## ADDED Requirements

### Requirement: Claude Provider Continuation MUST Resolve Runtime Model

Claude Provider Continuation MUST 遵守 Claude catalog 的 UI `id` / runtime `model` 分离
contract，并在 target-side effect 前验证已冻结的 model identity。

#### Scenario: Native Composer selects a settings override

- **WHEN** Native Composer 从另一 Claude Provider Profile 选择 settings override entry
- **THEN** picker MUST 保留该 entry 的 UI id 用于 selection identity
- **AND** continuation execution MUST 将 entry 的 runtime model 传给 Claude CLI

#### Scenario: legacy entry lacks runtime model

- **WHEN** legacy catalog entry 没有显式 runtime `model`
- **THEN** frontend MAY 显式 fallback 到 entry `id`
- **AND** backend MUST 仍执行 Provider-scoped validation
- **AND** MUST NOT 对已知 `id != model` entry 使用 legacy fallback
