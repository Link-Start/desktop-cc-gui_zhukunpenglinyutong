## ADDED Requirements

### Requirement: Background importer MUST upsert on-disk native sessions into Session Index

系统 MUST 用后台 Session Index importer（周期 sync + cursor backfill）把磁盘上仍存在、未被用户删除或 tombstone 的 native 会话写入 `session_index`。侧栏 first-paint MUST 继续只读 Session Index；本 requirement 禁止把引擎 disk list 搬回点击热路径。

#### Scenario: Disk-only session appears in SQLite after import tick

- **GIVEN** 某 workspace 磁盘上存在 native 会话 S，且 `session_index` 没有 `(engine, session_id)=S`
- **WHEN** importer 对该 workspace 跑完一次成功的 sync 或 backfill
- **THEN** `session_index` MUST 含有 S
- **AND** 随后的 `list_session_index_for_workspace` MUST 能返回 S

#### Scenario: Click path still does not scan engine disks

- **WHEN** importer 正在扫盘补账
- **THEN** first-paint / 切项目 / focus-refresh MUST NOT 调用 `listDshSessions` / `listPiSessions` / 各引擎 disk list
- **AND** 侧栏 MUST 继续只读 Session Index

### Requirement: Upgrade and cold-start first tick MUST force rescan

importer 进程生命周期的第一拍 MUST 对每个已加载 workspace 以 `force=true`（或等价失效全部 freshness）调用 sync。第一拍 MUST NOT 因 `SOURCE_FRESH_MAX_AGE_MS` 或旧 fingerprint 跳过。稳态后续拍 MAY 保持 `force=false`。

#### Scenario: First tick after relaunch is forced

- **GIVEN** 应用刚冷启或升级后首次启动 importer
- **WHEN** 第一拍开始
- **THEN** 每个 workspace 的 sync MUST 以 force 语义执行
- **AND** MUST NOT 返回「skipped_fresh」而不读盘

#### Scenario: Later ticks may keep freshness

- **GIVEN** 第一拍已经 force 完成
- **WHEN** 后续 90s 拍运行且磁盘 fingerprint 与账本一致
- **THEN** writer MAY skip 该 source
- **AND** MUST 仍遵守「磁盘比账本新则不得 skip」闸门

### Requirement: Freshness MUST NOT hide newer on-disk sessions

当 writer 即将因 fingerprint / freshness window 跳过某 source 时，若磁盘探测到的最新会话时间明显新于该 workspace+engine 在 `session_index` 的最新 `updated_at`，系统 MUST 视为不 fresh 并继续 sync。超时或 list error MUST NOT 把该 source 标成成功扫空。

#### Scenario: Root fingerprint unchanged but child session is newer

- **GIVEN** 引擎会话根目录 fingerprint 8s 内未变
- **AND** 子会话文件 mtime 新于账本该引擎 max(updated_at)
- **WHEN** sync 检查 freshness
- **THEN** writer MUST 继续扫描并 upsert 新行
- **AND** MUST NOT 以 skipped_fresh 结束

#### Scenario: Timeout does not mark source complete

- **WHEN** async engine list 超时
- **THEN** 系统 MUST NOT 把该 source 标 fresh
- **AND** 已有 `session_index` 行 MUST 保留

### Requirement: Import event MUST expose newly upserted rows

当 importer 对某 workspace `upserted > 0` 并发出 `session-index-imported` 时，该 workspace 的侧栏 hydration MUST 重新读取 Session Index，并把新行并入可见列表。用户 MUST NOT 需要手动 force refresh 才能看到刚补进账本的会话。

#### Scenario: Active workspace refreshes after import

- **GIVEN** 当前 active workspace 在 `session-index-imported.workspaceIds` 中
- **AND** 本拍 upserted > 0
- **WHEN** 前端收到事件
- **THEN** 系统 MUST 以 first-paint / Index-only 重读该 workspace
- **AND** 新 upsert 的 native 行 MUST 出现在侧栏（受 hide / archive / tombstone 过滤后）

#### Scenario: Zero upsert does not claim authoritative empty after forced partial

- **GIVEN** 本拍是 force 首拍且带 `partial_source`
- **AND** upserted = 0
- **WHEN** 前端处理结果
- **THEN** 系统 MUST NOT 把当前列表标成权威空
- **AND** MUST NOT 清掉 last-good 连续性行
