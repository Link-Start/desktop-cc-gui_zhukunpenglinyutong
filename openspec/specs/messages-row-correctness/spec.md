# messages-row-correctness Specification

## Purpose
TBD - created by archiving change fix-message-row-context-and-media-scope. Update Purpose after archive.
## Requirements
### Requirement: Message row equality covers rendered context

Message row memo comparator MUST 覆盖 `MessageRow` 读取的全部 render-affecting
context attachment fields，包括 browser 与 intent-canvas attachments。

#### Scenario: browser context changes without text changes

- **WHEN** message 的 id、role、text 不变，但 browser context attachment 更新
- **THEN** row MUST 渲染新的 browser context summary

#### Scenario: intent-canvas context changes without text changes

- **WHEN** message 的 id、role、text 不变，但 intent-canvas attachment list 更新
- **THEN** row MUST 渲染新的 intent-canvas context summary

### Requirement: Deferred image hydration is scope-safe

Deferred image completion MUST 仅在 workspace、thread、message、locator 与
request generation 均属于 current scope 时提交；completion stale 或 row unmount
时，renderer-owned transient object URL MUST 被 revoke。

#### Scenario: stale workspace completion

- **WHEN** 同一 locator 先在 workspace A、后在 workspace B 发起请求
- **AND** workspace A 在 workspace B 成为 current scope 后才完成
- **THEN** workspace A MUST NOT 更新 row，且 transient URL MUST 被 revoke

#### Scenario: unmount during hydration

- **WHEN** deferred image request 在 row unmount 后完成
- **THEN** MUST NOT 提交 state update，且 transient URL MUST 被 revoke

