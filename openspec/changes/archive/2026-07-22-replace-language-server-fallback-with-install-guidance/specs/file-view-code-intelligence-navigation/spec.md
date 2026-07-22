## MODIFIED Requirements

### Requirement: Missing Semantic Providers MUST Offer Platform-Specific Installation Hints

File editor SHALL 在 semantic provider executable unavailable 时，以 installation guidance 直接替换 generic fallback notice，按 current language 与 desktop operating system 展示可复制的 installation command 或 official download guide command，并 MUST 提供安装后的 explicit retry，同时保持 fallback result 可用。

#### Scenario: macOS Java provider is missing
- **WHEN** Java navigation 以 `provider-unavailable` 降级且客户端运行在 macOS
- **THEN** warning surface MUST 直接显示未检测到 Java language server
- **AND** MUST 明确显示 Homebrew `jdtls` install command
- **AND** MUST NOT 同时显示 generic “语言服务当前不可用，已改用快速搜索” notice
- **AND** user MUST 能复制 command
- **AND** MUST 能在安装完成后重新检测当前 navigation action

#### Scenario: Missing provider fallback has a single target
- **WHEN** definition 或 implementation 以 `provider-unavailable` 降级且 heuristic fallback 只返回一个 target
- **THEN** warning surface MUST 保持 installation guidance 可见
- **AND** fallback target MUST 继续作为可点击结果提供
- **AND** UI MUST NOT 在 warning 首次 render 前自动跳转并销毁该提示

#### Scenario: Windows or Linux Java provider is missing
- **WHEN** Java navigation 以 `provider-unavailable` 降级且客户端运行在 Windows 或 Linux
- **THEN** warning surface MUST 直接显示未检测到 Java language server
- **AND** MUST 使用当前 shell syntax 显示打开 Eclipse official download page 的 command
- **AND** MUST NOT 声称某个非通用 package manager 已完成安装
- **AND** MUST 提供安装后重新检测入口

#### Scenario: TypeScript JavaScript or Rust provider is missing
- **WHEN** TS/JS 或 Rust navigation 以 `provider-unavailable` 降级
- **THEN** warning surface MUST 直接显示未检测到对应 language server
- **AND** MUST 显示对应 npm 或 rustup command
- **AND** MUST 标识 current operating system
- **AND** MUST 提供安装后重新检测入口

#### Scenario: Provider failure is not an installation problem
- **WHEN** fallback reason 是 timeout、provider exit、invalid response 或 generic failure
- **THEN** UI MUST NOT 显示 installation command
- **AND** existing retry/error feedback MUST remain available

#### Scenario: Clipboard API is unavailable
- **WHEN** install hint 已显示但 clipboard API 不可用
- **THEN** command MUST remain selectable and readable
- **AND** navigation panel MUST NOT throw、hide retry 或 hide fallback results
