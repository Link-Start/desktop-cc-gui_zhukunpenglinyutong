## MODIFIED Requirements

### Requirement: LSP Failure and Unsupported Fallback

系统 MUST 对 provider 不可用、indexing、查询失败、当前 cursor 非 symbol、结果为空等场景提供 action-specific、localized、可解释状态，并 MUST NOT 将仍健康的 indexing provider 伪装成 fatal failure。

#### Scenario: backend lsp command unavailable
- **GIVEN** 当前环境不支持 definition/references/implementation 查询
- **WHEN** 用户触发对应 action
- **THEN** 系统 MUST 使用当前 UI language 显示“当前环境不支持”的 action-specific 提示
- **AND** MUST 保持编辑器可继续正常使用

#### Scenario: cursor is not on a navigable symbol
- **GIVEN** 光标位于 whitespace、comment、string、punctuation 或其他非 symbol 位置
- **WHEN** 用户触发 definition、references 或 implementation action
- **THEN** 系统 MUST 按 action 提示应将光标放在 class、method、variable、type 或 interface 等适用 symbol 上
- **AND** MUST NOT 直接展示 backend raw English error

#### Scenario: provider is still indexing at request deadline
- **GIVEN** Java、TypeScript/JavaScript 或 Rust provider process 仍存活
- **WHEN** semantic navigation request 达到 15 秒 soft deadline
- **THEN** UI MUST 显示 provider 仍在 indexing 或 temporarily degraded
- **AND** backend MUST NOT 自动执行 workspace-wide heuristic fallback
- **AND** 用户 MUST 能在稍后显式 retry

#### Scenario: query failure is surfaced without breaking editor
- **GIVEN** provider 查询因 file access、fatal runtime failure 或 invalid response 执行失败
- **WHEN** 前端收到错误或 fallback response
- **THEN** 系统 MUST 显示可区分的 localized failure/fallback 提示并允许用户重试
- **AND** MUST NOT 导致编辑器崩溃或内容丢失
