## ADDED Requirements

### Requirement: Importer And Focus MUST NOT Replace The Sidebar With First-Paint

`session-index-imported` 与 focus-refresh MUST 使用静默 merge（`mergeExistingThreads`），MUST NOT 使用 `startupHydrationMode: "first-paint"` 做 early-paint 或紧急整表 `setThreads`。

最终可见 membership MUST 为 Index ∪ 现有健康行 ∪ last-good floor。更短的 Index 页 MUST NOT 盖掉更长的健康列表。tombstone、用户删除、权威空证明 MUST 先于 union。stale list 请求 MUST NOT 提交。

#### Scenario: importer upsert does not flash the list

- **GIVEN** 用户正在查看当前 workspace 的侧栏
- **WHEN** `session-index-imported` 且 `upserted > 0`
- **THEN** 系统 MUST 重读 Index 并 merge
- **AND** MUST NOT 先清空或用 first-paint early-paint 替换可见列表
- **AND** 已画出且未被 tombstone 的顶层行 MUST 仍在

#### Scenario: partial index page does not evaporate extra rows

- **GIVEN** 内存侧栏已有 20 条健康顶层行
- **AND** 一次 Index list 只返回 12 条
- **WHEN** merge 提交
- **THEN** 那 8 条不在本页但未被删除 / tombstone 的行 MUST 保留
- **AND** Index 中更新的行 MUST 覆盖同 id 的旧标题（弱标题不得盖强标题）

#### Scenario: focus refresh stays merge-only

- **WHEN** 窗口 focus 触发 workspace thread list refresh
- **THEN** 该路径 MUST `mergeExistingThreads`
- **AND** MUST NOT 设置 `startupHydrationMode: "first-paint"`
