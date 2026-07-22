## MODIFIED Requirements

### Requirement: Semantic Provider Lifecycle MUST Be Bounded And Failure-Isolated

Semantic provider SHALL 按 workspace 复用 process，并 MUST 将 request health、process health 与 workspace readiness 分离，对 initialization、request cancellation、progress、exit 与 malformed response 做有界处理。

#### Scenario: First query starts a server
- **WHEN** workspace 尚无 semantic session 且用户触发 query
- **THEN** backend MUST lazy-start and initialize 对应 provider
- **AND** subsequent queries MUST reuse the live workspace session

#### Scenario: A request times out while the provider remains alive
- **WHEN** definition、references 或 implementation request 达到 15 秒 soft deadline
- **AND** provider process 与 stdio connection 仍存活
- **THEN** backend MUST cancel and settle that request without killing or evicting the session
- **AND** response MUST expose `indexing` 或 `degraded` lifecycle metadata
- **AND** subsequent queries MUST be able to reuse the same process

#### Scenario: Server is unavailable or exits
- **WHEN** executable 缺失、initialize 失败、process EOF 或 stdio failure 发生
- **THEN** backend MUST release or evict the failed session
- **AND** pending callers MUST complete with fallback or explicit bounded error
- **AND** editor MUST remain usable

#### Scenario: Java workspace becomes ready
- **WHEN** JDT LS reports `language/status` with `ServiceReady`
- **THEN** runtime MUST mark the workspace/provider session `ready`
- **AND** later navigation MUST reuse the warmed project index

#### Scenario: A single semantic response is invalid
- **WHEN** provider remains alive but one response contains an unsupported or out-of-workspace location
- **THEN** backend MUST reject or fallback that request without evicting the healthy session
- **AND** a later request MUST be able to reuse the same process

### Requirement: Semantic Sessions MUST Be Lazy And Bounded

Semantic navigation runtime SHALL 在首次打开 semantic-capable 文件后的 bounded idle prewarm 或显式 navigation action 时创建 provider session，并 MUST 限制 session 数量、idle lifetime、initialization、request 与 exit settlement。Initialization coordination MUST be scoped by `(provider, workspace)`，且 global session registry lock MUST NOT 跨 process lifecycle await。

#### Scenario: Typing and hover remain local
- **WHEN** 用户输入、移动光标或按 modifier hover symbol
- **THEN** frontend MUST NOT 发起 semantic query
- **AND** backend MUST NOT 因 typing 或 hover 启动 language server

#### Scenario: Opening a supported file prewarms one provider
- **WHEN** 用户首次打开 Java、TypeScript、JavaScript 或 Rust 文件且 editor idle window 到期
- **THEN** frontend MUST issue at most one scoped prepare request for that workspace/provider state
- **AND** stale timer or response MUST NOT overwrite the current file state

#### Scenario: Explicit query reuses a live session
- **WHEN** 同一 workspace/provider 连续执行多个 navigation query
- **THEN** runtime MUST 复用同一 live session，包括单次 request timeout 后仍健康的 session
- **AND** MUST opportunistically evict expired or over-cap idle sessions without polling

#### Scenario: Independent providers or workspaces initialize concurrently
- **WHEN** 不同 `(provider, workspace)` 同时触发 cold-start query
- **THEN** initialization coordination MUST 只串行化相同 `(provider, workspace)`
- **AND** global session registry lock MUST NOT 跨 process spawn、initialize 或 kill await

#### Scenario: Provider process fatally fails
- **WHEN** initialize failure、stdio failure 或 process exit 发生
- **THEN** pending caller MUST 有界完成
- **AND** failed session MUST 被淘汰以允许后续 retry 重建

## ADDED Requirements

### Requirement: Semantic Provider Data Ownership MUST Be Channel-Isolated

Semantic provider persistent data MUST distinguish development and release runtime channels，并 MUST prevent two processes in the same channel from owning the same provider/workspace data directory concurrently。

#### Scenario: Development and release clients open the same workspace
- **WHEN** development 与 packaged release client 使用相同 workspace
- **THEN** their provider data directories MUST be different
- **AND** each client MUST be able to build its own persistent warm index

#### Scenario: A second process targets an owned data directory
- **WHEN** another process already holds the provider/workspace owner lock
- **THEN** backend MUST refuse the second spawn deterministically
- **AND** MUST NOT allow both providers to mutate the same index directory
