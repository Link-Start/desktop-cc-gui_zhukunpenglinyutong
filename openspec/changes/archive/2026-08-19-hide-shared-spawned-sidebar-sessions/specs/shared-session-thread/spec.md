## MODIFIED Requirements

### Requirement: Shared Session Hidden Native Bindings Stay Internal

Native bindings owned by a `shared session` are runtime internals and MUST NOT become user-facing native conversations. This rule applies to every Shared-supported engine (`Claude`, `Codex`, `Kimi`, `Grok`, `OpenCode`), not only `Claude` / `Codex`.

Ownership MUST include:

- 当前 durable binding id
- Shared 续跑新写的 native 文件 sessionId（Claude `{fileUuid}.jsonl` 与信封 `binding:` 不必相同）
- 首条真实 user 为 MOSSX 协议包的 session，即使预览标题已被抽成用户原话

#### Scenario: selector change does not create a visible native conversation

- **WHEN** the user switches selected engine inside a `shared session` but has not sent a new turn
- **THEN** the system MUST persist the shared selector state for that session
- **AND** the system MUST NOT create an extra user-visible native conversation only because of that selector change

#### Scenario: shared-owned native bindings are filtered from native list surfaces

- **WHEN** thread list / tabs / reopen flows include both native sessions and shared sessions
- **THEN** native bindings marked as shared-owned internals MUST remain hidden from native conversation surfaces for Claude, Codex, Kimi, Grok, and OpenCode
- **AND** users MUST continue the conversation through the `shared session` identity

#### Scenario: grok shared binding does not appear as native sidebar row

- **WHEN** a Shared Session turn executes on Grok and materializes a Hidden Native Binding
- **THEN** the thread list MUST NOT show a separate Grok native row for that binding
  (including sessions whose first message is a context-package marker)
- **AND** the only user-facing conversation row for that work MUST remain the `shared:*` identity

#### Scenario: kimi and opencode shared bindings stay hidden after real id finalizes

- **WHEN** a Shared Session turn executes on Kimi or OpenCode and the runtime later finalizes a real native session id
- **THEN** the durable binding MUST be updated to that real identity
- **AND** subsequent thread list / catalog merges MUST hide that native id from user-facing native surfaces

#### Scenario: claude continuation file ids stay hidden from sidebar

- **WHEN** Shared 续跑为同一 `session:{sharedId}` 新写 `{fileUuid}.jsonl`，信封 binding 仍为旧 id
- **AND** 首条 user 为 `MOSSX_SHARED_CONTEXT_V1`，预览标题为「继续」
- **THEN** 侧栏 MUST NOT 展示 `claude:{fileUuid}` 为用户 native 会话
- **AND** hide set MUST 能以 `{fileUuid}` 命中其子代理 parent
