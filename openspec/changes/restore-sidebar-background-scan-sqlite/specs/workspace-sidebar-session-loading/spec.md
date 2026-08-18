## ADDED Requirements

### Requirement: Last-good snapshot MUST be a continuity floor not a ceiling

workspace sidebar 在 native hydration 时 MUST 把 last-good / `sidebarSnapshot` 当作连续性下限，而不是权威上限。

- Session Index 返回的行 MUST 始终可被看见（在 hide / archive / tombstone / 用户删除过滤之后）。
- last-good 中比当前 Index 页更新、或 Index 完全没有的 `(engine, session_id)` 行 MUST 暂时保留，直到 writer 确认磁盘已无或存在 tombstone。
- 系统 MUST NOT 仅因为 Index 非空就丢弃全部 last-good。
- 系统 MUST NOT 用更旧的 last-good 覆盖 Index 里更新的同一行。

#### Scenario: Non-empty stale Index keeps newer last-good rows

- **GIVEN** Session Index 返回会话 A、B（较旧）
- **AND** last-good 还含有更新的会话 C
- **AND** C 未被 tombstone / 用户删除
- **WHEN** 侧栏绘制 first-paint
- **THEN** 可见列表 MUST 含 A、B、C
- **AND** MUST NOT 只画 A、B

#### Scenario: Newer Index row wins over older last-good

- **GIVEN** last-good 中会话 A 的 updatedAt 早于 Session Index 中同一 A
- **WHEN** 侧栏合并投影
- **THEN** 可见的 A MUST 使用 Index 行
- **AND** MUST NOT 用旧 snapshot 标题或时间盖住 Index

#### Scenario: Authoritative empty does not resurrect last-good

- **GIVEN** sourceStatuses 对该引擎给出权威空证明
- **AND** last-good 仍记得该引擎旧行
- **WHEN** 侧栏绘制
- **THEN** 系统 MUST NOT 把这些旧行补回
- **AND** tombstone / 已删除行 MUST 继续被过滤

### Requirement: Empty Index fallback MUST NOT promote last-good to new authority

当当前 Index 页为空且没有权威空证明时，侧栏 MAY 继续画出 last-good 以免闪空。系统 MUST NOT 把这次 fallback 结果写成新的权威 last-good，以免升级前 snapshot 永久盖住后续到达的 Index 行。

#### Scenario: Empty timeout paints last-good without rewriting authority

- **GIVEN** first-paint Index 超时或返回空
- **AND** 没有权威空证明
- **AND** last-good 有连续性行
- **WHEN** 侧栏回落 last-good
- **THEN** 用户 MUST 仍能看到这些连续性行
- **AND** 系统 MUST NOT 用这次 fallback 覆盖 last-good 权威快照

#### Scenario: Later Index import replaces the empty fallback

- **GIVEN** 画面正显示 last-good fallback
- **WHEN** `session-index-imported` 带来更新的 Index 行
- **THEN** 侧栏 MUST 按 floor 规则并入新行
- **AND** MUST NOT 继续只画升级前 snapshot
