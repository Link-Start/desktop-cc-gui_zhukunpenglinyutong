# shared-session-identity Specification (delta: MODIFIED)

## MODIFIED Requirements

### Requirement: Merge MUST Preserve Shared Identity

系统 MUST 在线程列表 merge 时保护 `shared:` 前缀 id 条目的 `threadKind` 不丢失、不覆盖，并在 shared list 不可用时保留 previous frame 条目。

#### Scenario: merge never overwrites shared thread kind to non-shared

- **WHEN** 线程列表 merge 执行
- **AND** 某条目 id 以 `shared:` 开头
- **THEN** 结果条目的 `threadKind` MUST 恒为 `"shared"`（含 merge 后强制矫正）

#### Scenario: shared entry survives even when its source list is absent

- **WHEN** shared sessions 列表为空或加载失败（归一为空）
- **AND** previous frame（`existingThreads`）中存在 `shared:` 条目
- **THEN** merge 结果 MUST 仍包含这些 previous `shared:` 条目
- **AND** 补回数据源 MUST 为 previous frame，而非本轮 native-only `allSummaries`
- **AND** 当 list 非空时 MUST 以 list 为成员权威，不复活 list 中已不存在的 previous shared
