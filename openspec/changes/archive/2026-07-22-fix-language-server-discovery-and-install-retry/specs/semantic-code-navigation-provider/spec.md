## MODIFIED Requirements

### Requirement: External Language Servers MUST Respect Distribution And Launch Boundaries

mossx MUST NOT bundle Java、TypeScript 或 Rust language server artifact；新增 linked dependency MUST 使用 MIT 或 Apache-2.0 compatible license，其他 provider 只能由用户独立安装并作为 external process 调用。

#### Scenario: User-installed provider is discovered
- **WHEN** 用户通过 supported environment override、terminal package manager 或 supported user directory 安装 provider
- **THEN** backend MUST 先尊重 explicit override，再使用 cross-platform extended CLI search paths 解析 executable
- **AND** MUST 以 argument-safe process launch 启动 provider
- **AND** MUST NOT 把 override 当作 shell command string 执行

#### Scenario: Desktop GUI PATH differs from terminal PATH
- **WHEN** macOS、Windows 或 Linux desktop app process PATH 不包含 provider 或其 runtime dependency 所在目录
- **THEN** backend MUST 使用 supported platform search paths 发现 provider
- **AND** provider child MUST 获得 compatible extended PATH 以解析 `java`、`node` 或 toolchain dependency

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
