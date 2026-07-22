## ADDED Requirements

### Requirement: Missing Semantic Providers MUST Offer Platform-Specific Installation Hints

File editor SHALL 在 semantic provider executable unavailable 时，按 current language 与 desktop operating system 展示可复制的 installation command 或 official download guide command，并 MUST 保持 fallback result 可用。

#### Scenario: macOS Java provider is missing
- **WHEN** Java navigation 以 `provider-unavailable` 降级且客户端运行在 macOS
- **THEN** fallback note MUST 显示 Homebrew `jdtls` install command
- **AND** user MUST 能复制 command

#### Scenario: Windows or Linux Java provider is missing
- **WHEN** Java navigation 以 `provider-unavailable` 降级且客户端运行在 Windows 或 Linux
- **THEN** fallback note MUST 使用当前 shell syntax 显示打开 Eclipse official download page 的 command
- **AND** MUST NOT 声称某个非通用 package manager 已完成安装

#### Scenario: TypeScript JavaScript or Rust provider is missing
- **WHEN** TS/JS 或 Rust navigation 以 `provider-unavailable` 降级
- **THEN** fallback note MUST 显示对应 npm 或 rustup command
- **AND** MUST 标识 current operating system

#### Scenario: Provider failure is not an installation problem
- **WHEN** fallback reason 是 timeout、provider exit、invalid response 或 generic failure
- **THEN** UI MUST NOT 显示 installation command
- **AND** existing retry/error feedback MUST remain available

#### Scenario: Clipboard API is unavailable
- **WHEN** install hint 已显示但 clipboard API 不可用
- **THEN** command MUST remain selectable and readable
- **AND** navigation panel MUST NOT throw or hide fallback results
