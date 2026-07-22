# semantic-code-navigation-provider Specification

## Purpose

定义 editor code intelligence 的 workspace-scoped semantic provider、跨平台 process/URI boundary、失败隔离与有界 heuristic fallback，确保准确结果优先且 server 缺失时编辑器仍可用。

## Requirements

### Requirement: Rust Navigation MUST Prefer A Workspace-Scoped Semantic Provider

系统 SHALL 对 Rust definition、references 与 implementation query 优先使用 workspace-scoped `rust-analyzer` session，并 MUST 将标准 LSP locations 转换为既有 navigation location contract。

#### Scenario: Rust analyzer resolves a scoped symbol
- **WHEN** Rust file 中当前 symbol 在不同 scope 存在同名 declaration
- **AND** `rust-analyzer` 可用
- **THEN** navigation result MUST 使用 semantic server 返回的目标
- **AND** MUST NOT 混入 heuristic scanner 的无关同名目标

#### Scenario: Unsaved document is queried
- **WHEN** editor current text 与 disk snapshot 不同
- **THEN** semantic provider MUST 在 query 前发送 current document state
- **AND** returned positions MUST 对应 current document version

### Requirement: Semantic Provider Lifecycle MUST Be Bounded And Failure-Isolated

Semantic provider SHALL 按 workspace 复用 process，并 MUST 对 initialization、request、exit 与 malformed response 做有界处理。

#### Scenario: First query starts a server
- **WHEN** workspace 尚无 Rust semantic session 且用户触发 query
- **THEN** backend MUST lazy-start and initialize `rust-analyzer`
- **AND** subsequent queries MUST reuse the live workspace session

#### Scenario: Server is unavailable or exits
- **WHEN** executable 缺失、initialize 失败、request timeout 或 process EOF
- **THEN** backend MUST release or evict the failed session
- **AND** pending callers MUST complete with fallback or explicit bounded error
- **AND** editor MUST remain usable

### Requirement: Semantic Locations MUST Stay Inside The Workspace Trust Boundary

Backend MUST validate local file locations before exposing them as navigable workspace paths。

#### Scenario: Server returns an external or non-file URI
- **WHEN** semantic response contains non-`file:` URI or a path outside canonical workspace root
- **THEN** backend MUST discard that location
- **AND** MUST NOT open or read the external target

#### Scenario: Cross-platform file URI is returned
- **WHEN** server returns a valid macOS、Linux 或 Windows file URI inside workspace
- **THEN** backend MUST preserve correct path identity and zero-based LSP position

### Requirement: Heuristic Fallback MUST Be Explicit And Bounded

Rust navigation SHALL remain usable without `rust-analyzer` through a conservative scanner，且 fallback MUST obey existing ignore、file-size、result-count 与 deterministic ordering boundaries。

#### Scenario: Rust analyzer is not installed
- **WHEN** Rust navigation query cannot start `rust-analyzer`
- **THEN** backend MUST attempt bounded Rust fallback
- **AND** response MUST expose provider/fallback metadata without changing existing `result` shape

#### Scenario: Fallback scans a large workspace
- **WHEN** workspace contains ignored directories、oversized files 或超过 result cap 的 matches
- **THEN** fallback MUST skip ignored/oversized inputs
- **AND** MUST truncate results to the configured maximum
