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

### Requirement: Java And TypeScript Navigation MUST Prefer Semantic Providers

系统 SHALL 对 Java 与 TypeScript/JavaScript 的 definition、references、implementation query 优先使用 workspace-scoped semantic provider，并 MUST 将标准 LSP locations 转换为既有 navigation location contract。

#### Scenario: Java provider resolves overload and implementation
- **WHEN** 用户在 Java overload、interface 或 implementation method 上触发 navigation
- **AND** Java semantic provider 可用
- **THEN** result MUST 来自 provider 的 scope/type-aware resolution
- **AND** MUST NOT 混入 unrelated same-name heuristic matches

#### Scenario: TypeScript provider resolves module-scoped symbol
- **WHEN** 用户在 TypeScript 或 JavaScript import、class、method 或 variable symbol 上触发 navigation
- **AND** TypeScript semantic provider 可用
- **THEN** result MUST 遵循 active project/module resolution
- **AND** current unsaved document MUST 在 query 前同步给 provider

#### Scenario: Semantic provider returns authoritative empty
- **WHEN** provider 正常返回 empty definition、references 或 implementation result
- **THEN** command MUST 返回 semantic empty result
- **AND** MUST NOT 再运行 heuristic scanner 填充同名候选

### Requirement: External Language Servers MUST Respect Distribution And Launch Boundaries

mossx MUST NOT bundle Java、TypeScript、Rust、Python 或 Go language server artifact；新增 linked dependency MUST 使用 MIT 或 Apache-2.0 compatible license，其他 provider 只能由用户独立安装并作为 external process 调用。Provider launch environment MUST preserve supported search paths without introducing an empty executable-parent entry。

#### Scenario: User-installed provider is discovered
- **WHEN** 用户通过 supported environment override、terminal package manager 或 supported user directory 安装 provider
- **THEN** backend MUST 先尊重 explicit override，再使用 cross-platform extended CLI search paths 解析 executable
- **AND** backend MUST 以 argument-safe process launch 启动 provider
- **AND** MUST NOT 把 override 当作 shell command string 执行

#### Scenario: Desktop GUI PATH differs from terminal PATH
- **WHEN** macOS、Windows 或 Linux desktop app process PATH 不包含 provider 或其 runtime dependency 所在目录
- **THEN** backend MUST 使用 supported platform search paths 发现 provider
- **AND** provider child MUST 获得 compatible extended PATH 以解析 `java`、`node` 或 toolchain dependency

#### Scenario: Multiple npm runtimes coexist
- **WHEN** desktop environment 可发现多个 supported npm launchers，且 provider 安装在非首选 npm runtime
- **THEN** backend MUST 合并 bounded launcher-derived bin candidates，而不是只使用第一个 npm reported prefix
- **AND** search precedence MUST 保持 deterministic
- **AND** discovery MUST NOT 扫描未受限 filesystem roots

#### Scenario: Symlinked npm launcher uses a separate Node runtime
- **WHEN** npm launcher 经过一跳或多跳 symlink 最终指向 package-internal `npm-cli.js`
- **THEN** discovery MUST 保留 launcher 与每个 bounded symlink hop 的 parent directory
- **AND** npm prefix probe MUST 使用与 selected launcher chain compatible 的 runtime dependency path
- **AND** broken、cyclic 或 unreadable symlink MUST bounded fallback 到原有 cross-platform search paths

#### Scenario: Provider executable is a bare command name
- **WHEN** discovery fallback 使用 `jdtls`、`typescript-language-server` 或其他 bare executable name
- **THEN** child `PATH` MUST NOT 包含由 empty executable parent 产生的 empty component
- **AND** workspace current directory MUST NOT 因该 empty component 获得 executable lookup priority

#### Scenario: Windows wrapper is configured
- **WHEN** provider executable 是 Windows `.cmd` 或 `.bat` wrapper
- **THEN** backend MUST 使用 Windows-compatible wrapper launch path 并保持 stdio pipe 可用
- **AND** MUST NOT 弹出额外 console window

#### Scenario: Provider is installed after app launch
- **WHEN** provider 最初 unavailable 且用户在 app 运行期间完成安装
- **THEN** subsequent explicit retry MUST 重新执行 executable discovery
- **AND** MUST NOT 要求依赖 stale negative cache 或 app restart

#### Scenario: Provider is absent
- **WHEN** configured/default provider executable 不可用
- **THEN** command MUST 返回 bounded fast-search fallback 与 stable reason code
- **AND** MUST NOT 尝试联网下载或修改用户环境

### Requirement: Semantic Sessions MUST Be Lazy And Bounded

Semantic navigation runtime SHALL 在首次打开 semantic-capable 文件后的 bounded idle prewarm 或显式 navigation action 时创建 provider session，并 MUST 限制 session 数量、idle lifetime、initialization、request 与 exit settlement。Initialization coordination MUST be scoped by `(provider, workspace)`，且 global session registry lock MUST NOT 跨 process lifecycle await。

#### Scenario: Typing and hover remain local
- **WHEN** 用户输入、移动光标或按 modifier hover symbol
- **THEN** frontend MUST NOT 发起 semantic backend query
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
