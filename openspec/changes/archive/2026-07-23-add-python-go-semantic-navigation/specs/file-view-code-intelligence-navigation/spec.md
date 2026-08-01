## ADDED Requirements

### Requirement: Python Files MUST Use External Pyright Semantic Navigation

File editor SHALL 对 `.py` 与 `.pyi` 文件优先使用用户环境中的 external `pyright-langserver` 执行 definition、references 与 implementation semantic navigation，并 MUST 保持现有 response、fallback 与 editor safety contract。

#### Scenario: Pyright returns semantic locations

- **WHEN** 用户在 Python symbol 上触发 definition、references 或 implementation 且 Pyright 可用
- **THEN** backend MUST 返回 `mode=semantic`、`provider=pyright` 与 workspace-contained locations
- **AND** semantic empty result MUST remain authoritative and MUST NOT trigger same-name fast-search

#### Scenario: Pyright is unavailable

- **WHEN** `pyright-langserver` executable 不可用
- **THEN** definition/references MUST 保持 bounded fast-search fallback 与 `provider-unavailable` metadata
- **AND** UI MUST 显示 `npm install -g pyright` 但 MUST NOT 自动执行该命令
- **AND** editor content、selection 与 save behavior MUST remain available

#### Scenario: Python environment is externally owned

- **WHEN** workspace 使用 virtualenv、Conda、Poetry、uv 或 system Python
- **THEN** mossx MUST defer interpreter/environment resolution to Pyright workspace configuration
- **AND** mossx MUST NOT silently activate、modify or install a Python environment

### Requirement: Go Files MUST Use External gopls Semantic Navigation

File editor SHALL 对 `.go` 文件优先使用用户环境中的 external `gopls` 执行 definition、references 与 implementation semantic navigation，并 MUST 保持 module/workspace 与 process lifecycle 边界。

#### Scenario: gopls returns semantic locations

- **WHEN** 用户在 Go symbol 上触发 definition、references 或 implementation 且 gopls 可用
- **THEN** backend MUST 返回 `mode=semantic`、`provider=gopls` 与 workspace-contained locations
- **AND** interface implementation targets MUST preserve multi-target navigation behavior

#### Scenario: gopls is unavailable

- **WHEN** `gopls` executable 不可用
- **THEN** definition/references MUST 保持 bounded fast-search fallback 与 `provider-unavailable` metadata
- **AND** UI MUST 显示 `go install golang.org/x/tools/gopls@latest` 但 MUST NOT 自动执行该命令
- **AND** editor MUST NOT crash or modify the opened file

#### Scenario: Go toolchain failure remains external

- **WHEN** gopls 因 Go toolchain、module download、GOPROXY 或 unsupported build system 失败
- **THEN** mossx MUST surface a localized retryable degraded state
- **AND** mossx MUST NOT mutate Go environment、module files or proxy configuration

### Requirement: Python And Go Providers MUST Reuse Bounded LSP Lifecycle

Pyright 与 gopls SHALL 复用现有 workspace-scoped semantic runtime、request deadline、cancellation、fatal-only eviction、session cap 与 idle eviction contract，且 MUST NOT 增加 editor hot-path work。

#### Scenario: Python or Go request reaches soft deadline

- **WHEN** live Pyright 或 gopls request 达到 semantic request soft deadline
- **THEN** backend MUST cancel that request and retain the live session for explicit retry
- **AND** MUST NOT automatically start workspace-wide heuristic fallback

#### Scenario: Python or Go file becomes idle after open

- **WHEN** `.py`、`.pyi` 或 `.go` file 打开后达到 existing idle prewarm delay
- **THEN** frontend MAY call the existing `code_intel_prepare` command once per scoped file identity
- **AND** typing、modifier hover、cursor movement MUST NOT trigger semantic queries

#### Scenario: Provider process exits fatally

- **WHEN** Pyright 或 gopls process exits、EOF 或 stdin transport fails
- **THEN** runtime MUST evict only that provider/workspace session and expose retryable degraded metadata
- **AND** unrelated providers and workspaces MUST remain usable

### Requirement: Python And Go Provider Distribution MUST Remain External

mossx SHALL treat Pyright and gopls as user-installed external executables and MUST preserve their independent license and distribution boundary。

#### Scenario: Desktop application is packaged

- **WHEN** mossx desktop artifacts are built or distributed
- **THEN** Pyright and gopls binaries MUST NOT be bundled by this change
- **AND** provider absence MUST degrade to installation guidance rather than an automatic download

#### Scenario: Future bundled distribution is proposed

- **WHEN** a future change proposes bundling Pyright or gopls
- **THEN** that change MUST separately define license notices、artifact integrity、update、rollback 与 platform packaging contracts
