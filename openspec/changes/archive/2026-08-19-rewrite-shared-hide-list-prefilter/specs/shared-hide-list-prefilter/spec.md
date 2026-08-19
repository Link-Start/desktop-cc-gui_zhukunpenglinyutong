## ADDED Requirements

### Requirement: Thread-list ingest prefilters use Shared hide identity

侧栏 `listThreads` orchestrator 在把 native session **写入 merge map 之前**的 Shared hide 预过滤 MUST 与 Shared hide identity 使用同一判定：`threadIdInHiddenSharedBindingSet`（即 `sharedHideIdentityIntersects`）。

预过滤 MUST 覆盖以下 ingest 入口：

- live Codex `listThreads` 行
- live Claude / OpenCode 行
- project catalog session 行
- OpenCode / DSH continuity 保留行
- Gemini / Kimi / Grok / Pi / DSH cache 与异步 refresh 预过滤

系统 MUST NOT 在上述入口使用 exact `Set.has(literalId)` 作为 Shared hide 判定。
系统 MUST NOT 使用 first-colon / last-colon / `indexOf(":")` 剥离来匹配 hide set。
系统 MUST NOT 发明未观测到的 Codex rollout 时间戳。
系统 MUST NOT 回退 0.9.1 hide-unreadiness（last-good / full-show）。

Candidate id MUST 是该行进入侧栏后的 id：

- Codex：live `entry.id` 或 catalog `sessionId` 的字面值
- 其它引擎：`engine:sessionId` 或已存在的 `thread.id`

Windows 盘符 / UNC / extended path 与 POSIX 绝对路径 MUST NOT 被预过滤误藏，也 MUST NOT 被当成 engine 前缀剥离。

#### Scenario: live Codex rollout stem is dropped before merge

- **WHEN** hide set 仅由 `{uuid}` 或 `codex:{uuid}` expand 而来（集合内无 `rollout-` 键）
- **AND** live Codex 行 id 为 `rollout-YYYY-MM-DDTHH-MM-SS-{uuid}`
- **THEN** ingest 预过滤 MUST 丢弃该行
- **AND** 该行 MUST NOT 进入 merge map

#### Scenario: catalog sessionId stem uses identity not first-colon

- **WHEN** catalog `sessionId` 为 `rollout-YYYY-MM-DDTHH-MM-SS-{uuid}` 或 `codex:rollout-YYYY-MM-DDTHH-MM-SS-{uuid}`
- **AND** hide set 仅有 `{uuid}` / `codex:{uuid}`
- **THEN** catalog 预过滤 MUST 丢弃该 session
- **AND** 实现 MUST NOT 用 `indexOf(":")` 计算 hide 命中

#### Scenario: prefixed engine rows use the sidebar id as candidate

- **WHEN** Claude / OpenCode / Kimi / Grok / Pi / Gemini / DSH 预过滤面对 `engine:{sessionId}` 行
- **AND** hide set 经 expand 含该行 identity（含 raw / `engine:raw` / Codex uuid 变体）
- **THEN** 预过滤 MUST 丢弃该行
- **AND** Gemini / DSH MUST 传入带前缀 candidate，不得只传 bare sessionId

#### Scenario: continuity keep-path respects identity hide

- **WHEN** OpenCode 或 DSH continuity 准备保留已有 `thread.id`
- **AND** 该 id 与 hide set identity 相交
- **THEN** 系统 MUST NOT 把该行重新写入 merge map

#### Scenario: filesystem path ids are not colon-hidden

- **WHEN** candidate 为 `S:\AIWorker\proj`、`\\?\C:\…`、UNC、`/Users/…` 或 `/home/…`
- **AND** hide set 不含该路径字面值，也不含与其相交的 identity
- **THEN** 预过滤 MUST NOT 丢弃该行
- **AND** MUST NOT 把盘符或 POSIX 路径当成 engine 前缀剥离后再查 hide set

#### Scenario: hide unreadiness policy stays last-good

- **WHEN** Shared visibility 未就绪
- **THEN** 系统 MUST 继续 last-good / full-show
- **AND** MUST NOT 因本预过滤重写改回 empty-hide fail-closed
