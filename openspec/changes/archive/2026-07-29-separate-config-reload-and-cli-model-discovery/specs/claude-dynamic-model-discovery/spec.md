## ADDED Requirements

### Requirement: Claude Catalog Actions MUST Not Imply Unsupported CLI Discovery

Claude Code 模型目录 MUST 允许重读 settings/env/provider configuration，但 MUST NOT 声称通过 CLI model-list 获取模型。

#### Scenario: Reload Claude configuration
- **WHEN** 用户对 Claude local 或 managed Provider 执行 `Reload Config`
- **THEN** backend MUST 重新读取对应 settings/env/provider model fields
- **AND** selector MUST 合并 custom 与 builtin catalog

#### Scenario: Claude discovery capability
- **WHEN** 当前 Claude CLI 没有已验证的 model-list protocol
- **THEN** `Discover Models` MUST NOT 显示为可执行 action
- **AND** 系统 MUST NOT 调用 HTTP、解析 help 或返回 builtin entries 冒充 discovered models
