## ADDED Requirements

### Requirement: Catalog Projection MUST Recover Legacy Codex Continuation Keys

Workspace session catalog projection MUST 将历史
`codex:<workspace>:codex:<thread-id>` continuation metadata key 仅作为
`codex:<workspace>:<thread-id>` 的 legacy alias 读取。Projection MUST 依据 exact
`sourceSessionId` chain 恢复 authoritative Family identity 与 depth，MUST NOT 根据标题、时间、
Provider 或邻近关系猜测。

#### Scenario: legacy duplicated key matches a raw Codex row

- **WHEN** raw catalog row `<thread-id>` 只有 duplicated legacy continuation key
- **THEN** row MUST 获得 `provider-continuation` origin、source lineage 与 Provider snapshot
- **AND** catalog MUST NOT 额外生成 missing/recovery Session

#### Scenario: two legacy continuations form a chain

- **WHEN** target B 的 exact `sourceSessionId` 指向 target A，且 A 指向同一 legacy root
- **THEN** projection MUST 为 A 与 B 派生相同 `familyId` 和 `familyRootSessionId`
- **AND** B 的 `lineageDepth` MUST 等于 A depth 加一
- **AND** Sidebar MUST 通过既有 Family fence 连续展示可见成员

#### Scenario: legacy lineage contains a cycle

- **WHEN** exact source references 形成 cycle 或无法安全解析
- **THEN** catalog MUST fail open 为普通 top-level projection 或保留 stored metadata
- **AND** MUST NOT 通过内容相似度猜测 Family
