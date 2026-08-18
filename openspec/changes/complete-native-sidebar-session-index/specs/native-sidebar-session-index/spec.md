## ADDED Requirements

### Requirement: Native sidebar list reads Session Index only

侧栏 native thread 列表 MUST 只从 `list_session_index_for_workspace`（Session Index / SQLite）读取。系统 MUST NOT 在 first-paint、切项目、focus-refresh 或日常 refresh 热路径上调用 `list_workspace_sessions`、`listDshSessions`、`listPiSessions` 或各引擎 disk list。

`list_workspace_sessions` catalog MUST 仅服务 Session 管理页与用户显式 force refresh。

#### Scenario: First-paint does not scan engine disks

- **WHEN** active workspace 以 `startupHydrationMode=first-paint` 拉取 native 侧栏
- **THEN** 客户端 MUST 只请求 Session Index
- **AND** MUST NOT invoke `listDshSessions`
- **AND** MUST NOT invoke `listPiSessions`
- **AND** MUST NOT invoke Gemini / Grok / Kimi / OpenCode disk list

#### Scenario: Focus refresh stays on Index

- **WHEN** 窗口 focus 触发侧栏 refresh
- **THEN** 系统 MUST 只读 Session Index
- **AND** MUST NOT 因 focus 启动 exhaustive catalog 或 engine disk list

### Requirement: Indexed native rows MUST remain listable

native 行一旦写入 `session_index` 且未被用户删除 / tombstone，系统 MUST 仍能通过当前 workspace 的路径变体将其列出。磁盘文件还在、账本行还在、侧栏看不见，视为本 capability 失败。

#### Scenario: Windows path variants see the same Grok rows

- **GIVEN** 一条 Grok 行已写入 `session_index`，`workspace_path` 为 `C:\Work\app`
- **WHEN** 同一项目以 `c:\work\app` 或 `\\?\C:\Work\app` 打开并 list Session Index
- **THEN** 该 Grok 行 MUST 出现在返回页中
- **AND** 系统 MUST NOT 要求整页为空才启用路径等价匹配

#### Scenario: PI encoded-cwd rows follow the same key

- **GIVEN** 一条 PI 行已写入 `session_index`，其磁盘身份位于 `sessions/<encoded-cwd>/`
- **WHEN** workspace 路径仅发生 Windows 风格大小写或 `\\?\` 前缀变化
- **THEN** 该 PI 行 MUST 仍被 list 返回

### Requirement: Workspace path key MUST be canonical on write and read

`normalize_path_key`（或后继同名入口）MUST 对写入的 `workspace_path` / `cwd` 与 list 查询键使用同一套规则：trim、去掉 `\\?\` / `//?/`、统一斜杠、去掉尾斜杠、对 Windows 风格路径做 ASCII case-fold。

系统 MUST NOT 把 junction / subst / 最终卷路径解析算进这把钥匙。

#### Scenario: Long-path prefix collapses

- **WHEN** writer 或 list 收到 `\\?\C:\Work\app`
- **THEN** 使用的钥匙 MUST 与 `C:\Work\app` 的 canonical key 相同

#### Scenario: Drive letter case collapses

- **WHEN** writer 使用 `C:\Work\app` 写入，list 使用 `c:\work\app` 查询
- **THEN** exact 快路径 MUST 命中同一把钥匙

### Requirement: Writer timeout MUST NOT commit an empty success

Gemini / Grok / PI / DSH 及未来同类 async writer 在 list timeout 或 list error 时 MUST：

- 保留该 workspace 下该引擎已有、未 tombstone 的 `session_index` 行
- 不把空数组当成成功扫空去 `upsert`
- 不把该 source 标成 fresh，以免下一拍跳过

list 成功且确实 0 行时，writer MAY 标记 synced。

#### Scenario: Grok list timeout keeps existing rows

- **GIVEN** Session Index 已有该 workspace 的 Grok 行
- **WHEN** `list_grok_sessions` 超过 `ASYNC_ENGINE_LIST_TIMEOUT`（当前 3s）
- **THEN** 已有 Grok 行 MUST 仍可被 list 返回
- **AND** 返回诊断 MUST 带 `partial_source`（如 `grok-sync-timeout`）
- **AND** 随后的 freshness 检查 MUST NOT 因这次超时而 skip 再扫

#### Scenario: Successful empty Grok list may mark synced

- **GIVEN** 该 workspace 磁盘上确实没有 Grok sessions
- **WHEN** `list_grok_sessions` 在超时前成功返回空列表
- **THEN** writer MAY 标记该 source synced
- **AND** MUST NOT 删除其他引擎的行

### Requirement: Every native writer engine MUST be listable

每个会向 `session_index` 写入的 native 引擎 MUST 出现在 `INDEX_LIST_ENGINES`（或后继白名单），从而能被 `list_session_index_for_workspace` 与 `session-index::` keyset 翻到。

当前集合 MUST 包含：`claude`, `codex`, `gemini`, `grok`, `kimi`, `opencode`, `pi`, `dsh`。

Shared MUST NOT 进入该白名单。OpenCode 历史 backfill 保持显式 skip。

#### Scenario: DSH rows appear in sidebar Index pages

- **GIVEN** DSH writer 已把会话写入 `session_index`
- **WHEN** 侧栏 first-paint 或用户点「更多」走 `session-index::` keyset
- **THEN** 这些 DSH 行 MUST 出现在对应页
- **AND** 系统 MUST NOT 依赖 `listDshSessions` 探针才能看到它们

#### Scenario: Engine table sentinel fails closed

- **WHEN** 新增 native writer 引擎但未加入 `INDEX_LIST_ENGINES`，或 async writer 未遵守超时不空提交契约
- **THEN** CI 哨兵 MUST 失败

### Requirement: Sidebar expose count equals Index fetch count

侧栏默认露出的 unpinned native root 条数 MUST 等于首页 Session Index 拉取条数（当前 12）。用户点「更多」时，系统 MUST 把可见上限按 `page * pageSize` 递增（12 / 24 / 36 / 48…），先露出已拉但未画的行，只有已拉页耗尽才再发一次固定 page size 的 `session-index::` keyset。侧栏 MUST NOT 再展示独立的「加载更早的」入口。

#### Scenario: First paint exposes and fetches 12

- **GIVEN** workspace 未配置 `visibleThreadRootCount`
- **WHEN** 侧栏 first-paint 读取 Session Index
- **THEN** 系统 MUST 拉取 12 条 unpinned native root
- **AND** MUST 只露出这 12 条

#### Scenario: More consumes in-memory page first

- **GIVEN** 首页已拉取 24 条 native root，画面只露出 12 条
- **WHEN** 用户点「更多」
- **THEN** 系统 MUST 把可见上限提高到 24 并露出已拉未画的 root
- **AND** MUST NOT 在已拉页耗尽前再发 Index IPC
- **AND** MUST NOT 把超过当前可见上限的 in-memory root 全部 dump 出来

#### Scenario: Keyset continues after in-memory page is exhausted

- **GIVEN** 已拉页已全部露出且 `has_more` 为 true
- **WHEN** 用户再次点「更多」
- **THEN** 系统 MUST 使用现有 `session-index::` keyset 再拉固定 12 条
- **AND** MUST NOT 回落到 catalog cursor，除非当前 cursor 已经是 `catalog::`

#### Scenario: Collapse resets to the first page

- **GIVEN** 用户已经把可见上限提高到 24 或以上
- **WHEN** 用户点「收起」
- **THEN** 系统 MUST 把可见上限重置为首页 12 条
- **AND** MUST NOT 再展示独立的「加载更早的」link

#### Scenario: Folder inner lists have no paging chrome

- **GIVEN** 会话位于 `system-auto` 或其他 folder 内层列表
- **WHEN** 侧栏渲染该 folder
- **THEN** folder 内层 MUST NOT 展示「更多」「收起」或「加载更早的」
- **AND** workspace 级「更多 / 收起」MUST 仍出现在 folder 树下方

### Requirement: Background writer cadence stays off the click path

Session Index 写层 MUST 保持后台周期（当前 45s 首拍 / 90s 一拍）与双游标（查询 keyset + `session_index_backfill.cursor`）。扫盘 MUST NOT 上切项目或 first-paint 热路径。

Quiet post-first-paint 工作 MUST 只做 Index soft re-sync，MUST NOT 再叫 full-catalog。

#### Scenario: Soft re-sync is Index only

- **WHEN** first-paint 完成后调度静默补扫
- **THEN** 系统 MUST 只触发 Session Index sync / soft re-sync
- **AND** MUST NOT enqueue exhaustive `list_workspace_sessions`
