## MODIFIED Requirements

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
