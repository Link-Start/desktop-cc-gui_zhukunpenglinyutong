## ADDED Requirements

### Requirement: Shared Sidebar List MUST Read shared_sessions_v2

侧栏 Shared 列表的权威读源 MUST 是 `shared_sessions_v2` SQLite，MUST NOT 以 Shared 目录 walk 为权威。`native_thread_ids`（供 hide native binding）MUST 从 `shared_binding_state` 聚合。

`shared_sessions_v2` MUST 持久化侧栏所需的 `workspace_id` 与 `title`。创建、改标题、选 target 时 MUST 同步写入。升级或空列时 MUST 在写层 backfill（从既有 Shared meta upsert），MUST NOT 把全量目录扫描挂到 first-paint / 切项目热路径。

migration 失败 MUST fail closed（沿用 event log 打开策略），MUST NOT silently 回退扫目录并假装列表完整。

#### Scenario: list comes from sqlite

- **GIVEN** `shared_sessions_v2` 中存在属于当前 workspace 的 session 行且 title 非空
- **WHEN** 侧栏拉取 Shared 列表
- **THEN** 这些行 MUST 出现在侧栏
- **AND** list 实现 MUST NOT 以 `read_dir(shared sessions directory)` 作为权威来源

#### Scenario: write path keeps sqlite listable

- **WHEN** 用户创建一条 Shared 会话或修改其标题
- **THEN** 系统 MUST upsert `shared_sessions_v2` 的 `workspace_id` 与 `title`
- **AND** 无需再扫目录，下一次 list 就能看到该行

#### Scenario: upgrade backfill restores missing columns

- **GIVEN** 升级前 v2 行没有 `workspace_id` / `title`
- **AND** 磁盘 Shared meta 仍在
- **WHEN** 写层 backfill 运行
- **THEN** 这些行 MUST 被补上 workspace / title
- **AND** 随后侧栏 list MUST 能按当前 workspace 查出它们
