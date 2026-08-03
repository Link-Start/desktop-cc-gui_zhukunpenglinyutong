## ADDED Requirements

### Requirement: Local Provider Expansion MUST Read The Authoritative Configured Catalog

当用户在 Shared Session picker 中显式展开 local/disk Provider 时，系统 MUST 按完整
`engine + local provider sentinel` scope 重新读取 configured catalog。已完成的
module-level stale cache MUST NOT 覆盖本次结果；同 scope 的 concurrent request MUST
继续合并。

#### Scenario: stale Claude local cache is bypassed

- **WHEN** module cache 仍包含旧 Claude local catalog，用户从 Codex CLI 切换浏览到
  Claude Code 并展开 `Local Settings.json`
- **THEN** frontend MUST 请求 Claude local scope 的 forced refresh
- **AND** rendered rows MUST 来自当前 configured catalog
- **AND** backend persistence validation MUST 能验证同一 catalog/runtime identity pair

#### Scenario: concurrent local expansion is coalesced

- **WHEN** pointer、focus 或重复 activation 在首个 Claude local refresh 完成前触发相同
  scope 的加载
- **THEN** frontend MUST 复用同一个 in-flight request
- **AND** MUST NOT 创建第二个并发 IPC

#### Scenario: repeated activation after successful refresh reuses the result

- **WHEN** 同一 picker catalog owner 已成功完成 local authoritative refresh，随后
  pointer、focus 或 accordion activation 再次请求同一 scope
- **THEN** frontend MUST 直接复用本次 owner 已完成的 catalog
- **AND** MUST NOT 再次进入 loading 或创建第二次 forced refresh

#### Scenario: Native loading preserves last-good rows

- **WHEN** Native 单栏正在刷新 Provider catalog，且当前 binding 已有 last-good models
- **THEN** selector MUST 保持这些 rows 可见、可交互
- **AND** Shared local stale-row suppression MUST NOT 泄漏到 Native 模式

#### Scenario: managed provider retains normal cache behavior

- **WHEN** 用户展开 managed Provider Profile
- **THEN** frontend MUST 继续按 binding-scoped cache 加载 catalog
- **AND** local forced-refresh policy MUST NOT 使无关 managed catalog 失效
