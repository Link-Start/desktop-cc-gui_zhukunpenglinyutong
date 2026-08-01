## Purpose

Define bounded one-click install and update behavior for Codex and Claude Code CLI tooling, including command whitelisting, user confirmation, platform boundaries, post-install doctor chaining, and structured installer output.
## Requirements
### Requirement: CLI Validation MUST Offer Bounded Installer Actions For Codex And Claude

系统 MUST 在 `CLI 验证` 面板中为 Codex 与 Claude Code 提供受控安装 / 更新入口，并且该入口不得扩展到任意 shell 执行；Claude Code 的安装入口 MUST 基于官方 native installer preflight，而不是 Node/npm 检测。

#### Scenario: Claude install action is offered after missing doctor

- **WHEN** 用户在 Claude Code tab 运行 doctor
- **AND** doctor 结果显示 Claude CLI 不可用
- **AND** installer preflight 判断平台支持官方 native installer（macOS/Linux 需 `/bin/bash`，Windows 需 PowerShell）
- **THEN** 系统 MUST 提供 “安装最新版” 操作
- **AND** 操作 MUST 通过 backend installer command 执行，而不是 frontend 拼接 shell
- **AND** Claude install MUST NOT 将 Node/npm 缺失视为 blocker

### Requirement: Installer MUST Use Explicit Plan And User Confirmation

系统 MUST 在执行安装或更新前生成 install plan，并等待用户显式确认。

#### Scenario: install plan is shown before execution

- **WHEN** 用户点击 Codex 或 Claude Code 的安装 / 更新入口
- **THEN** 系统 MUST 展示 install plan
- **AND** plan MUST 包含 engine、action、strategy、execution backend、platform、command preview、warnings 与 blockers
- **AND** 系统 MUST NOT 在用户确认前执行安装命令

#### Scenario: blocked plan remains non-mutating

- **WHEN** install plan 包含 Node/npm 缺失、npm prefix 不可写、权限不足或 unsupported platform blocker
- **THEN** 系统 MUST 禁止执行安装
- **AND** MUST 展示 manual fallback 或 remediation hint
- **AND** MUST NOT 尝试自动修复 Node/npm、权限或 PATH 持久化配置

### Requirement: Installer Backend MUST Enforce Command Whitelist

backend MUST 只允许枚举化安装策略，不得执行 frontend 传入的 raw command；Claude Code 的 install/update/uninstall MUST 走官方 native installer 路径，Codex / Kimi MUST 走 npm global 官方 package。

#### Scenario: phase one command matrix is bounded

- **WHEN** backend 构造 installer command
- **THEN** Codex / Kimi install/update/uninstall MUST 使用 npm global strategy 安装或卸载官方 package
- **AND** Claude Code installLatest MUST 使用官方 native installer：
  - macOS / Linux / WSL: `curl -fsSL https://claude.ai/install.sh | bash`
  - Windows: `irm https://claude.ai/install.ps1 | iex`
- **AND** Claude Code updateLatest MUST 使用 `claude update`（`cliSelfUpdate` strategy）
- **AND** Claude Code uninstall MUST 仅删除官方 native 安装路径（`~/.local/bin/claude` 与 `~/.local/share/claude`，Windows 对应 `%USERPROFILE%\.local\...`）
- **AND** Codex / Kimi MUST NOT 执行 CLI self-update commands such as `codex --upgrade`
- **AND** backend MUST 忽略 frontend 对 Claude 传入的过时 `npmGlobal` strategy，并改写为上述有效 strategy

### Requirement: Installer MUST Preserve Platform Boundaries

系统 MUST 对 macOS、Windows native、WSL 与 Linux-like remote 环境保持可解释的平台边界。

#### Scenario: macOS local uses non-Windows process resolution

- **WHEN** desktop app 在 macOS local backend 下执行 installer
- **THEN** backend MUST 使用 macOS 可用的 process resolution 与 PATH 语义
- **AND** MUST NOT 依赖 Windows `.cmd` wrapper 或 Windows shell

#### Scenario: Windows native uses Windows process resolution

- **WHEN** desktop app 在 Windows native local backend 下执行 installer
- **THEN** backend MUST 使用 Windows process resolution
- **AND** MUST NOT 依赖 `/bin/sh`、bash 或 zsh
- **AND** npm / CLI wrapper handling MUST 保持 argv 语义，而不是拼接 raw shell string

#### Scenario: desktop app does not cross-install into WSL

- **WHEN** desktop app 运行在 Windows native 环境
- **AND** 目标 workspace 或 configured path 指向 WSL / Linux boundary
- **THEN** Phase 1 installer MUST NOT 从 Windows desktop 跨边界修改 WSL 用户环境
- **AND** 系统 MUST 提示使用 remote daemon inside WSL/Linux 或展示手动命令

### Requirement: Installer MUST Run Doctor After Mutation

系统 MUST 在安装或更新动作结束后自动运行对应 doctor，并把结果纳入 installer result。

#### Scenario: successful installer refreshes doctor state

- **WHEN** installer command 成功退出
- **THEN** 系统 MUST 自动运行对应 Codex 或 Claude doctor
- **AND** frontend MUST 展示 post-install doctor 结果
- **AND** engine availability SHOULD refresh based on the new doctor state

#### Scenario: failed installer remains diagnosable

- **WHEN** installer command 失败、超时或被拒绝
- **THEN** result MUST 包含结构化 failure details、exit code if available、stdout/stderr summary if available
- **AND** 系统 MUST 保留对应 engine 的 blocked / unavailable 状态
- **AND** MUST NOT silently mark the CLI as installed

### Requirement: Installer MUST Not Escalate Privileges Or Persist Shell Changes

系统 MUST 禁止 installer 自动提权或修改用户 shell 持久化配置。

#### Scenario: no automatic sudo or administrator escalation

- **WHEN** npm global install 因权限不足失败
- **THEN** 系统 MUST return permission blocker
- **AND** MUST NOT 自动执行 `sudo`、管理员提权、UAC 提权、PowerShell policy 修改或等价操作

#### Scenario: installer does not rewrite profile or app settings

- **WHEN** installer 成功或失败
- **THEN** 系统 MUST NOT 自动改写 shell profile、PATH 配置、npm prefix、`codexBin` 或 `claudeBin`
- **AND** 如果用户显式路径仍不可用，doctor MUST 继续展示该 blocker 并提示用户选择 PATH 或更新路径

### Requirement: Installer Output MUST Be Structured And Bounded

installer result MUST 以结构化、可脱敏、可截断的方式返回执行结果，并且长耗时安装 MUST 提供可见的进度反馈。

#### Scenario: output summaries are bounded

- **WHEN** installer 返回 stdout 或 stderr
- **THEN** backend MUST 限制输出摘要长度
- **AND** SHOULD redact common token/key patterns before exposing to frontend
- **AND** MUST include strategy/backend/duration or equivalent diagnostic fields

#### Scenario: running installer streams progress

- **WHEN** 用户确认执行 Codex 或 Claude Code installer
- **THEN** backend MUST emit run-scoped progress events for installer start, stdout/stderr chunks, and completion or error
- **AND** frontend MUST filter events by run id before rendering
- **AND** frontend MUST show live log output or an explicit waiting state while the command is running
- **AND** streamed chunks MUST follow the same redaction and bounded-length rules as final output summaries

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

### Requirement: Vendor CLI Lifecycle Header MUST Remain Collision-Free

Vendor CLI lifecycle header MUST preserve readable, reachable proxy/version/update/refresh actions across supported viewport widths and localized copy lengths.

#### Scenario: current version and proxy status coexist

- **WHEN** proxy status、local CLI version、latest status 与 refresh action 同时可见
- **THEN** action group MUST use normal flow layout and wrap when horizontal space is insufficient
- **AND** no badge or button MAY overlap provider content、header title or another action

#### Scenario: update is available

- **WHEN** local version、latest version、update button 与 refresh button 同时可见
- **THEN** all actions MUST remain reachable and retain their accessible names
- **AND** update/latest badges MUST NOT be clipped by an overflow container

#### Scenario: narrow settings viewport

- **WHEN** vendor settings content width cannot contain title and lifecycle actions on one row
- **THEN** header MUST move actions to a separate row or column within normal document flow
- **AND** action alignment MUST remain stable in light and dark themes

### Requirement: CLI Version Status MUST Reject Shell Startup Noise

CLI version status MUST distinguish canonical CLI version output from login shell startup banners and MUST distinguish unknown latest status from confirmed latest status.

#### Scenario: proxy banner precedes Claude version

- **WHEN** interactive login shell output contains proxy notice、diagnostic copy、binary path 与 canonical Claude version
- **THEN** backend MUST select only the canonical Claude version line
- **AND** proxy URL or IP address MUST NOT become `localVersion`

#### Scenario: latest version probe is unknown

- **WHEN** local version is known but registry latest version is unavailable or invalid
- **THEN** header MUST show the local version without “已是最新”
- **AND** update action MUST remain hidden

#### Scenario: latest version is confirmed

- **WHEN** local version and latest version are both valid semver
- **THEN** header MUST show update target/action only when latest is greater than local
- **AND** header MAY show “已是最新” only when no greater version exists
