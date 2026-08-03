## ADDED Requirements

# codex-model-catalog-coverage Delta

### Requirement: User-Managed Custom Codex Models MUST Expose Mainstream Reasoning Options

用户通过「自定义模型」管理器写入 localStorage 的 Codex 自定义模型（`source: custom`）在缺少 reasoning metadata 时，MUST 暴露公共默认档位 `low/medium/high/xhigh` 且默认档为 `medium`，使 reasoning selector 可用、effort 选择不丢失。该默认档 MUST NOT 覆盖 runtime `model/list` 或 authoritative catalog 的 identity 匹配 metadata；MUST NOT 应用于 CLI runtime 发现的 unknown model（`source` 非 custom 的未登记模型保持 capability-neutral）。

#### Scenario: Custom codex model without metadata

- **WHEN** 用户添加自定义 Codex 模型且无 reasoning metadata
- **THEN** reasoning selector MUST 展示 low/medium/high/xhigh 四档
- **AND** 默认档 MUST 为 medium

#### Scenario: Custom model matches authoritative identity

- **WHEN** 自定义模型 runtime identity 命中 authoritative catalog
- **THEN** authoritative metadata MUST 覆盖公共默认档
- **AND** 公共默认档 MUST NOT 覆盖 runtime 返回

#### Scenario: Custom model selection preserves effort

- **WHEN** 用户在 Atomic picker 选择自定义 Codex 模型且 target reasoning 为空
- **THEN** 生成的 ExecutionTarget MUST 播种 `reasoning = { effort: "medium" }`
- **AND** 用户已选 effort MUST 不被覆盖

#### Scenario: Unknown runtime model stays neutral

- **WHEN** CLI discovery 返回的 unknown model 无 reasoning metadata
- **THEN** selector MUST 保持“默认”展示与 `selectedEffort = null`
- **AND** 不因本 requirement 获得伪造 capability
