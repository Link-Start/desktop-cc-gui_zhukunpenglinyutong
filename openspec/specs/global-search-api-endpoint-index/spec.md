# global-search-api-endpoint-index Specification

## Purpose
TBD - created by archiving change add-api-endpoint-global-search. Update Purpose after archive.
## Requirements
### Requirement: Global search SHALL hydrate a workspace-scoped endpoint index
系统 SHALL 为每个 workspace 维护与 workspace identity 绑定的 API endpoint index，并复用 Project Map 已支持的 endpoint extractor；该索引不得要求用户预先打开或扫描 Project Map。

#### Scenario: Missing cache triggers lazy disk indexing
- **WHEN** 用户打开包含 API filter 的全局搜索，且目标 workspace 没有 endpoint cache
- **THEN** 系统 MUST 将该 workspace 标记为 loading，并在后台从磁盘构建 endpoint-only index
- **AND** 系统 MUST NOT 将尚未扫描解释为 confirmed empty

#### Scenario: Cache hit avoids redundant scan
- **WHEN** endpoint cache 存在、ownership 有效且未 stale
- **THEN** 系统 MUST 直接返回 cached endpoints
- **AND** 系统 MUST NOT 启动重复磁盘扫描

#### Scenario: Stale cache remains searchable during refresh
- **WHEN** endpoint cache 存在但 workspace fingerprint 表明其 stale
- **THEN** 系统 SHALL 允许旧 endpoints 继续参与搜索并标记 refreshing
- **AND** 系统 MUST 在后台刷新且以新 scan generation 原子替换 cache
- **AND** UI MUST NOT 将 refreshing 显示为首次建立索引的 blocking loading

#### Scenario: Global hydration has partial cached coverage
- **WHEN** global scope 中至少一个 workspace 已有 cached endpoints，且其他 workspace 仍在 loading 或 refreshing
- **THEN** cached endpoints MUST 立即参与搜索
- **AND** aggregate API hydration state MUST be refreshing rather than blocking loading

### Requirement: Endpoint indexing MUST be bounded and query-independent
endpoint disk indexing MUST 在 backend blocking worker 中执行，遵守 workspace ignore rules、支持文件类型与资源 budget；query 变化只能查询内存 snapshot，不得触发磁盘扫描。

#### Scenario: Repeated query changes
- **WHEN** 用户在一次 palette session 中连续修改 query
- **THEN** 系统 MUST 复用当前 endpoint snapshot
- **AND** backend disk scan count MUST NOT 随 keystroke 增长

#### Scenario: Concurrent hydration request
- **WHEN** 同一 workspace 已有 endpoint scan in flight 且再次请求 hydration
- **THEN** 系统 MUST 去重 scan
- **AND** consumers SHALL 收敛到同一最新 generation

#### Scenario: Palette lifecycle changes during hydration
- **WHEN** endpoint scan 进行中且 palette scope、filter、workspace 或 open state 变化
- **THEN** 新 consumer MUST 复用 workspace-scoped in-flight request
- **AND** active consumer MUST 最终收敛到 complete 或 error，不得永久停留在 loading/refreshing

### Requirement: Endpoint index state MUST distinguish empty from unavailable
系统 MUST 暴露 loading、ready、empty、stale/refreshing 与 error 等可判定状态，且某个 workspace 失败不得阻断其他 search providers。

#### Scenario: Confirmed empty workspace
- **WHEN** endpoint scan 成功完成且返回零 endpoints
- **THEN** 系统 MUST 标记 confirmed empty
- **AND** UI MAY 展示未发现接口

#### Scenario: Endpoint scan failure
- **WHEN** endpoint cache 不存在且磁盘扫描失败
- **THEN** 系统 MUST 暴露 retryable error
- **AND** file、thread、message 等其他 provider MUST 继续返回结果

### Requirement: API endpoint provider SHALL support fast-request-compatible search intent
系统 SHALL 支持按 path、`HTTP method + path`、handler、operation、description、protocol、framework、module 与 source file 搜索 Project Map 已识别的全部 endpoint 类型。

#### Scenario: Search by HTTP method and path
- **WHEN** 用户输入 `get /users`
- **THEN** matching GET endpoints with `/users` path MUST rank above partial general matches

#### Scenario: Search non-HTTP endpoint
- **WHEN** 用户输入 GraphQL operation、RPC handler 或 ABI symbol
- **THEN** corresponding Project Map endpoint MUST be eligible for results

### Requirement: API endpoint result SHALL navigate to source
API search result MUST 保留 workspace identity、endpoint identity 与 source file；可靠 source line 存在时 SHALL 同时保留 line。

#### Scenario: Open endpoint result
- **WHEN** 用户选择另一个 workspace 的 API endpoint result
- **THEN** 系统 MUST 切换到正确 workspace 并打开 endpoint source file
- **AND** reliable line evidence 存在时 MUST 将 handler line 尽量置于编辑器视觉中心、聚焦并提供短暂行反馈
- **AND** line evidence 缺失或无效时 MUST 安全降级为打开文件
- **AND** centered navigation MUST remain inside the lazy editor implementation，不得将 CodeMirror runtime 拉入 file panel shell
