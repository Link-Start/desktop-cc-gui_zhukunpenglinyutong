## MODIFIED Requirements

### Requirement: Codex Sidebar Title Truth MUST Apply Stable Precedence

`Codex` sidebar / recent conversation surfaces MUST 对标题采用稳定 truth precedence；当前 `CODEX_HOME/session_index.jsonl` 为 session UUID 持久化的最新有效 `thread_name` MUST 作为 native catalog title，且一旦某条 session 已经获得比 ordinal fallback 更强的标题 truth，后续 refresh MUST NOT 将其回退为 `Agent x` 或新的 ordinal fallback。

#### Scenario: confirmed title is not downgraded to ordinal fallback
- **WHEN** 某条 `Codex` session 已经拥有 persisted custom title、mapped title、catalog title 或其它更强标题 truth
- **AND** 后续 refresh 重新构建该 session summary
- **THEN** 系统 MUST 继续显示当前 strongest confirmed title
- **AND** 系统 MUST NOT 将其回退为 `Agent x`、`Codex Session` 或等价 ordinal fallback

#### Scenario: stronger title source may upgrade weaker title source
- **WHEN** 某条 `Codex` session 当前只有 weaker title source，例如 transient first-user rename 或 ordinal fallback
- **AND** 后续 refresh 提供了更强的 authoritative catalog title 或 persisted mapped title
- **THEN** 系统 MUST 允许该更强 title source 升级当前显示标题
- **AND** 系统 MUST 保持该 upgraded title 在后续 refresh 中稳定可见

#### Scenario: native Codex rename replaces first-message preview
- **WHEN** 当前 session 所属 `CODEX_HOME/session_index.jsonl` 包含其 UUID 的一个或多个有效 `thread_name` records
- **THEN** backend catalog `title` 与 optional `nativeTitle` MUST 使用最后一个有效 `thread_name`
- **AND** first-message preview MUST NOT 覆盖该 native title

#### Scenario: weak-looking native Codex rename remains authoritative
- **WHEN** 有效 `thread_name` 恰好为 `Agent 12`、`Codex Session` 或短 hexadecimal string
- **THEN** frontend MUST 依据 `nativeTitle` 显示该名称
- **AND** fallback title-strength heuristic MUST NOT 保留旧 first-message title

#### Scenario: Codex rename index remains home scoped
- **WHEN** 一次 refresh 扫描多个 default、workspace override 或 managed provider homes
- **THEN** 每条 session MUST 只应用其 rollout 所属 home 的 rename index
- **AND** 另一 home 中相同或不同 UUID 的 record MUST NOT 污染该 title

#### Scenario: invalid Codex rename metadata preserves fallback
- **WHEN** session index 缺失、不可读，或仅包含 malformed、空白 title records
- **THEN** session MUST 继续使用既有 summary / first-message fallback
- **AND** rename metadata failure MUST NOT 移除该 session
