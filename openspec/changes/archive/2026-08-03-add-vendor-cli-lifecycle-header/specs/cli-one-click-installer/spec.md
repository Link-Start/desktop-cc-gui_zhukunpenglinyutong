## ADDED Requirements

### Requirement: VendorSettings Header MUST Expose CLI Version And Lifecycle Actions

系统 MUST 在 CLI配置管理（VendorSettings）的 Claude / Codex / Kimi 详情 brand header 展示本机 CLI 版本，并提供受控的安装 / 升级 / 卸载入口。

#### Scenario: local version is shown when CLI is installed

- **WHEN** 用户打开 Claude、Codex 或 Kimi 的 CLI配置管理详情
- **AND** 本机可解析到对应 CLI binary 版本
- **THEN** header MUST 展示 local version
- **AND** MUST 提供卸载入口

#### Scenario: not installed state is shown when CLI is missing

- **WHEN** 用户打开 Claude、Codex 或 Kimi 的 CLI配置管理详情
- **AND** 本机无法解析到对应 CLI binary 版本
- **THEN** header MUST 展示未安装态
- **AND** MUST 提供安装入口
- **AND** MUST NOT 展示升级入口

#### Scenario: upgrade is shown only when outdated

- **WHEN** local version 与 npm registry latest version 均可解析为 semver
- **AND** latest > local
- **THEN** header MUST 展示升级入口

#### Scenario: upgrade stays hidden when registry probe fails

- **WHEN** `npm view` 失败、超时，或任一侧版本无法解析为 semver
- **THEN** header MUST NOT 展示升级入口
- **AND** 若 CLI 已安装，仍 MUST 保留卸载入口

### Requirement: Version Status Probe MUST Be Bounded And Read-Only

系统 MUST 提供只读 `cli_version_status` 探测，且不得执行任意 shell。

#### Scenario: whitelist npm view for latest version

- **WHEN** backend 查询 Claude / Codex / Kimi 的 latest version
- **THEN** MUST 仅允许对白名单 package 执行 `npm view <pkg> version`
- **AND** package MUST 分别为 `@anthropic-ai/claude-code`、`@openai/codex`、`@moonshot-ai/kimi-code`
- **AND** MUST NOT 接受 frontend 传入的任意 package 名或 raw command

#### Scenario: install mutation still requires plan confirmation

- **WHEN** 用户从 VendorSettings header 点击安装、升级或卸载
- **THEN** 系统 MUST 先调用现有 `cli_install_plan` 并等待用户确认
- **AND** MUST NOT 在确认前执行 `cli_install_run`

#### Scenario: successful mutation refreshes header version status

- **WHEN** VendorSettings header 发起的 installer 成功结束
- **THEN** 系统 MUST 刷新对应 engine 的 version status
- **AND** header 展示的版本与按钮态 MUST 反映最新探测结果
