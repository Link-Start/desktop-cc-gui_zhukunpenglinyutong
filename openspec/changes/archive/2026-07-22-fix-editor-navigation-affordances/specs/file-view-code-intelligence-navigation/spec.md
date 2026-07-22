## MODIFIED Requirements

### Requirement: LSP Failure and Unsupported Fallback

系统 MUST 对 provider 不可用、查询失败、当前 cursor 非 symbol、结果为空等场景提供 action-specific、localized、可解释回退。

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

#### Scenario: query failure is surfaced without breaking editor
- **GIVEN** provider 查询因 timeout、file access 或 runtime failure 执行失败
- **WHEN** 前端收到错误响应
- **THEN** 系统 MUST 显示可区分的 localized failure 提示并允许用户重试
- **AND** MUST NOT 导致编辑器崩溃或内容丢失

## ADDED Requirements

### Requirement: Modifier Hover MUST Reveal Navigable Symbol Affordance

File editor SHALL 在用户按住 platform-primary modifier 时，为鼠标下可导航 identifier 提供 link-like visual affordance，且 MUST NOT 因 hover 触发 backend navigation request。

#### Scenario: Modifier hover enters an identifier
- **WHEN** 用户在 macOS 按住 `Cmd` 或在 Windows/Linux 按住 `Ctrl`
- **AND** pointer 位于 syntax tree 识别的 identifier/symbol token 上
- **THEN** token MUST 显示 underline
- **AND** pointer MUST 显示 clickable cursor

#### Scenario: Modifier hover enters a non-symbol region
- **WHEN** pointer 位于 whitespace、comment、string 或 punctuation
- **THEN** editor MUST NOT 显示 link-like affordance

#### Scenario: Modifier hover state ends
- **WHEN** modifier keyup、pointer leaves editor、window blur 或 document visibility 结束当前 interaction
- **THEN** active symbol decoration MUST be cleared immediately

#### Scenario: Hover does not query provider
- **WHEN** pointer 在按住 modifier 时跨 symbol 移动
- **THEN** editor MUST resolve affordance from local editor state
- **AND** MUST NOT call definition/reference/implementation backend solely because of hover
