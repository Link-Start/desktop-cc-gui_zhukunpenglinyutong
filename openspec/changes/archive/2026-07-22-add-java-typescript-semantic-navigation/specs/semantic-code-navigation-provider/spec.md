## ADDED Requirements

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

mossx MUST NOT bundle Java、TypeScript 或 Rust language server artifact；新增 linked dependency MUST 使用 MIT 或 Apache-2.0 compatible license，其他 provider 只能由用户独立安装并作为 external process 调用。

#### Scenario: User-installed provider is discovered
- **WHEN** 用户通过 supported environment override 或 PATH 安装 provider
- **THEN** backend MUST 以 argument-safe process launch 启动 provider
- **AND** MUST NOT 把 override 当作 shell command string 执行

#### Scenario: Windows wrapper is configured
- **WHEN** provider executable 是 Windows `.cmd` 或 `.bat` wrapper
- **THEN** backend MUST 使用 Windows-compatible wrapper launch path 并保持 stdio pipe 可用
- **AND** MUST NOT 弹出额外 console window

#### Scenario: Provider is absent
- **WHEN** configured/default provider executable 不可用
- **THEN** command MUST 返回 bounded fast-search fallback 与 stable reason code
- **AND** MUST NOT 尝试联网下载或修改用户环境

### Requirement: Semantic Sessions MUST Be Lazy And Bounded

Semantic navigation runtime SHALL 只在显式 navigation action 时创建 provider session，并 MUST 限制 session 数量、idle lifetime、initialization、request 与 exit settlement。

#### Scenario: Typing and hover remain local
- **WHEN** 用户输入、移动光标或按 modifier hover symbol
- **THEN** frontend MUST NOT 发起 semantic backend query
- **AND** backend MUST NOT 因这些事件启动 language server

#### Scenario: Explicit query reuses a live session
- **WHEN** 同一 workspace/provider 连续执行多个 navigation query
- **THEN** runtime MUST 复用同一 live session
- **AND** MUST opportunistically evict expired or over-cap idle sessions without polling

#### Scenario: Provider times out or exits
- **WHEN** initialize/request timeout、malformed response 或 process exit 发生
- **THEN** pending caller MUST 有界完成
- **AND** failed session MUST 被淘汰以允许后续 retry 重建
