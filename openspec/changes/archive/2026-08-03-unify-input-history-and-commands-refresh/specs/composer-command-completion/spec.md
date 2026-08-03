## ADDED Requirements

### Requirement: Custom commands list MUST NOT fall back to global scope on empty workspace result

工作区命令列表为空时 MUST 展示空列表，MUST NOT 以全局命令列表冒充；空结果重试冷却 MUST 移除。

#### Scenario: empty workspace shows empty list

- **WHEN** 当前 workspace 无任何自定义命令
- **THEN** 命令补全 MUST 只展示内建 slash 命令
- **AND** MUST NOT 发起 `getClaudeCommandsList(null)` 全局兜底请求

#### Scenario: server failure is visible and distinct from empty

- **WHEN** `commands/list` 请求失败或超时降级
- **THEN** 系统 MUST 通过 error toast 提示命令服务暂不可用（按 id 去重）
- **AND** 后续成功刷新后 MUST 不再重复提示
