## ADDED Requirements

### Requirement: Stale empty native sessions MUST be deleted from disk and Index

系统 MUST 在 `list_session_index_for_workspace` 的首页（非 keyset）返回之前，清理当前 workspace 中同时满足以下全部条件的 native 会话：

1. 标题是占位名（`{engine} session` / `{Engine} Session` / `PI session {8hex}` / `DeepSeek Harness Session` / `Warmup`）或标题等于 `session_id`
2. 年龄锚点（优先 `created_at`，否则 `updated_at`）距现在 ≥ 10 分钟
3. 引擎确认没有真实用户提问（Claude/Grok/PI 读盘，DSH peek 最新一页 history；`{engine}-pending-{millis}-{nonce}` 本地草稿视为已确认空，只 tombstone Index，不删盘）

清理 MUST 删除引擎磁盘记录，并按精确 `(engine, session_id)` `tombstone`。系统 MUST NOT 只从侧栏隐藏，MUST NOT 用裸 `session_id` 给其他引擎打 tombstone。

#### Scenario: Empty Grok placeholder older than 10 minutes is removed

- **GIVEN** 一条 Grok Index 行标题为 `grok session` 或等于 `session_id`
- **AND** `created_at` 早于现在 10 分钟以上
- **AND** 其 `chat_history.jsonl` 没有真实 user prompt
- **WHEN** 该 workspace 拉取首页 Session Index
- **THEN** 系统 MUST 删除该 Grok session 目录
- **AND** MUST tombstone 该行
- **AND** 返回页 MUST NOT 再包含该 `session_id`

#### Scenario: Empty Claude placeholder older than 10 minutes is removed

- **GIVEN** 一条 Claude Index 行标题为 `claude session` 或 `Claude Session`
- **AND** 年龄锚点 ≥ 10 分钟
- **AND** jsonl 中没有真实 user/human 文本
- **WHEN** 该 workspace 拉取首页 Session Index
- **THEN** 系统 MUST 删除该 jsonl
- **AND** MUST tombstone 该行

#### Scenario: Claude command-only jsonl is treated as empty

- **GIVEN** 一条 Claude 占位行年龄 ≥ 10 分钟
- **AND** jsonl 只有无参数 `/resume` / `/clear` 或 `<local-command-*>` user 行
- **WHEN** prune 运行
- **THEN** 系统 MUST 删除该 jsonl
- **AND** MUST tombstone 该行

#### Scenario: Claude injection-envelope jsonl is treated as empty

- **GIVEN** 一条 Claude 占位行年龄 ≥ 10 分钟
- **AND** jsonl 的 user 行只有 `<system-reminder>` / `<user_info>` / `<git_status>` 等注入信封，剥掉后没有真实提问
- **WHEN** prune 运行
- **THEN** 系统 MUST 删除该 jsonl
- **AND** MUST tombstone 该行

#### Scenario: Claude injection envelope plus real prompt is kept

- **GIVEN** 一条 Claude 占位行年龄 ≥ 10 分钟
- **AND** 同一条 user 文本在注入信封之后仍有真实提问
- **WHEN** prune 运行
- **THEN** 系统 MUST 保留该 jsonl

#### Scenario: Empty PI placeholder older than 10 minutes is removed

- **GIVEN** 一条 PI Index 行标题为 `PI session {8hex}` 或 `pi session`
- **AND** 年龄锚点 ≥ 10 分钟
- **AND** 已定位到 `*_{sessionId}.jsonl` 且其中没有 user message
- **WHEN** 该 workspace 拉取首页 Session Index
- **THEN** 系统 MUST 删除该 jsonl
- **AND** MUST tombstone 该行

#### Scenario: Warmup-titled empty Claude jsonl is removed

- **GIVEN** 一条 Claude Index 行标题为 `Warmup`
- **AND** 年龄锚点 ≥ 10 分钟
- **AND** jsonl 只有 Warmup / 注入信封，没有真实 user 文本
- **WHEN** prune 运行
- **THEN** 系统 MUST 删除该 jsonl
- **AND** MUST tombstone 该行

#### Scenario: Stale local pending draft is tombstoned without disk delete

- **GIVEN** 一条 Index 行 `session_id` 为 `{engine}-pending-{millis}-{nonce}`（`writeClientCreatedSessionIndex` 乐观建会话）
- **AND** 标题是占位名
- **AND** 年龄锚点 ≥ 10 分钟
- **WHEN** 该 workspace 拉取首页 Session Index
- **THEN** 系统 MUST tombstone 该行
- **AND** MUST NOT 调用引擎删盘 API
- **AND** MUST NOT 因 locator 找不到文件而跳过
- **AND** `*-pending-shared-*` / `*-pending-subagent:*` MUST 跳过

#### Scenario: Empty DSH placeholder older than 10 minutes is archived

- **GIVEN** 一条 DSH Index 行标题为 `dsh session` 或 `DeepSeek Harness Session`
- **AND** 年龄锚点 ≥ 10 分钟
- **AND** DSH host 已在跑
- **AND** 最新一页 history 在跳过 injected runtime context 后没有真实 user，且 `hasMore` 为 false
- **WHEN** 该 workspace 拉取首页 Session Index
- **THEN** 系统 MUST 调用 `archive_dsh_session`
- **AND** MUST tombstone 该行

### Requirement: Sessions with a real first user prompt MUST NOT be pruned

只要磁盘上存在真实用户提问，系统 MUST NOT 因弱标题、UUID 标题或较小的 `size_bytes` 删除该会话。

#### Scenario: Weak title with real user prompt is kept

- **GIVEN** 一条会话标题仍是 `Grok Session` 或 UUID
- **AND** `chat_history.jsonl` / Claude jsonl 里已有真实 user prompt
- **WHEN** prune 运行
- **THEN** 系统 MUST 保留磁盘文件
- **AND** MUST NOT tombstone 该行

#### Scenario: Custom-named empty draft is kept

- **GIVEN** 用户把标题改成非占位名（例如「我的草稿」）
- **AND** 磁盘仍无用户提问
- **WHEN** prune 运行
- **THEN** 系统 MUST 保留该会话

### Requirement: Shared and unconfirmed engines MUST be skipped

系统 MUST NOT prune Shared 会话。对无法确认内容为空的引擎行（Grok/PI locator 未命中、DSH host 未挂或最新页 `hasMore` 且无 user），系统 MUST 跳过，不得猜测 tombstone。

#### Scenario: Missing Grok directory is not tombstoned

- **GIVEN** 一条 Grok 占位行年龄已超过 10 分钟
- **AND** `sessions/<encoded-cwd>/<id>/` 的 O(1) 候选都不存在
- **WHEN** prune 运行
- **THEN** 系统 MUST 跳过该行
- **AND** MUST NOT 写入 tombstone

#### Scenario: Grok summary without chat_history is not tombstoned

- **GIVEN** 一条 Grok 占位行年龄已超过 10 分钟
- **AND** session 目录只有 `summary.json`，没有 `chat_history.jsonl`
- **WHEN** prune 运行
- **THEN** 系统 MUST 跳过该行
- **AND** MUST NOT 写入 tombstone

#### Scenario: Missing Claude jsonl is not tombstoned

- **GIVEN** 一条 Claude 占位行年龄已超过 10 分钟
- **AND** `physical_path` 指向的 jsonl 不存在，reconstructed 路径也打不开
- **WHEN** prune 运行
- **THEN** 系统 MUST 跳过该行
- **AND** MUST NOT 写入 tombstone

#### Scenario: Missing PI file is not tombstoned

- **GIVEN** 一条 PI 占位行年龄已超过 10 分钟
- **AND** `*_{sessionId}.jsonl` 定位失败
- **WHEN** prune 运行
- **THEN** 系统 MUST 跳过该行
- **AND** MUST NOT 写入 tombstone

#### Scenario: DSH host down is not tombstoned

- **GIVEN** 一条 DSH 占位行年龄已超过 10 分钟
- **AND** `connect_existing` 失败
- **WHEN** prune 运行
- **THEN** 系统 MUST 跳过该行
- **AND** MUST NOT 写入 tombstone

#### Scenario: Shared sessions are never candidates

- **WHEN** prune 扫描 Index
- **THEN** `engine=shared` 的行 MUST 被忽略

### Requirement: Prune MUST NOT fail the sidebar list

prune 错误 MUST NOT 使 `list_session_index_for_workspace` 失败。keyset「更多」MUST NOT 触发 prune。单次删除 MUST 有上限。

#### Scenario: Keyset page does not prune

- **WHEN** 客户端带 `before_updated_at` 翻页
- **THEN** 系统 MUST NOT 运行 stale empty prune

#### Scenario: Prune error still returns Index rows

- **GIVEN** 某个候选删除抛错
- **WHEN** 首页 list 继续
- **THEN** 系统 MUST 仍返回其余 Index 行
- **AND** 该失败候选 MUST 保持未 tombstone

#### Scenario: User prompt written after collect is not deleted

- **GIVEN** collect 时 Claude jsonl 仍为空
- **AND** 删除前用户写入了真实提问
- **WHEN** prune 执行 delete
- **THEN** 系统 MUST 跳过该行
- **AND** MUST NOT tombstone

#### Scenario: created_at stays sticky across DSH refresh

- **GIVEN** 一条 DSH 行首次 upsert 的 `created_at` 已超过 10 分钟
- **AND** 后续 sync 用更新的 `createdAt`/`updatedAt` 再 upsert
- **WHEN** prune 计算年龄
- **THEN** 系统 MUST 仍使用第一次写入的 `created_at`

### Requirement: Unreadable or budget-exhausted scans MUST be Unknown

jsonl 打开失败、单行超 cap、扫描行数耗尽尚未 EOF，系统 MUST 视为 `Unknown`，MUST NOT 删除。

#### Scenario: Unreadable jsonl is skipped

- **GIVEN** 一条 Claude 占位行年龄 ≥ 10 分钟
- **AND** jsonl 打开失败或扫描未到 EOF
- **WHEN** prune 运行
- **THEN** 系统 MUST 跳过该行
