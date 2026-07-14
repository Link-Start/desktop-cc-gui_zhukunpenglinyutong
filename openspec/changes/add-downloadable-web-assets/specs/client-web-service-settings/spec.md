## ADDED Requirements

### Requirement: Web Service Settings MUST Manage Downloadable Frontend Assets

系统 MUST 在 Web Service 设置区域检测当前 App version 对应的 managed Web assets，并提供显式的下载安装与重新检测动作。

#### Scenario: Missing assets expose an install action
- **WHEN** 用户打开 Web Service 设置且 `<app-data>/web-assets/current` 不包含当前版本的有效 Web assets
- **THEN** UI MUST 显示未安装状态与“下载安装”动作
- **AND** 本地 Web Service 启动动作 MUST 保持 disabled

#### Scenario: Remote and development runtimes are not locally gated
- **WHEN** Web Service 指向非 loopback remote daemon 或 desktop client 运行于 development build
- **THEN** desktop-local managed assets missing 状态 MUST NOT 阻止既有 Web Service start command
- **AND** development checkout asset discovery MUST 保持可用

#### Scenario: Ready assets expose their installed version
- **WHEN** managed Web assets 通过版本、manifest、entrypoint 与目录完整性检测
- **THEN** UI MUST 显示已安装状态与 installed version
- **AND** 本地 Web Service 启动动作 MUST 可按既有端口与 daemon 条件执行

#### Scenario: Install action is single-flight and re-checkable
- **WHEN** 用户触发下载安装
- **THEN** UI MUST 在 command 完成前显示 installing 状态并阻止重复安装动作
- **AND** command 完成后 MUST 使用返回状态刷新 UI
- **AND** 失败状态 MUST 保留重新安装或重新检测入口

#### Scenario: Ready assets remain repairable and async actions expose progress
- **WHEN** 当前版本 Web assets 已安装
- **THEN** UI MUST 保留“重新下载安装”动作以支持同版本覆盖修复
- **AND** 下载安装、本地安装或重新检测执行期间，触发按钮 MUST 显示 loading indicator 与对应忙碌文案
- **AND** 所有 Web assets 操作 MUST 在当前动作完成前保持 disabled
- **AND** 用户主动操作 MUST 在资源状态行下方显示开始、成功或 backend error 的可访问 operation log

#### Scenario: Local release-format package can be selected explicitly
- **WHEN** 用户选择本地 `ccgui-web-assets_<version>.zip`
- **THEN** desktop backend MUST 读取相邻的 `<archive>.sha256`
- **AND** MUST 复用 download installation 的 checksum、ZIP safety、manifest、version、entrypoint 与 staging activation 校验
- **AND** 文件选择取消 MUST 保持当前安装状态不变

#### Scenario: Invalid local package keeps the previous installation
- **WHEN** 本地 ZIP、相邻 checksum、manifest 或 assets version 无效
- **THEN** backend MUST 返回可定位的 failed status
- **AND** MUST NOT 删除或替换先前可用的 `current` directory

### Requirement: Downloadable Web Assets Installation MUST Be Transactional and Validated

Desktop backend MUST 从当前 App version 对应的 Release 下载唯一的跨平台 ZIP，并在激活前完成 HTTP、SHA-256、ZIP path、manifest、version 与 entrypoint 校验。

#### Scenario: Valid archive is installed atomically
- **WHEN** checksum 与 ZIP 下载成功且 archive 内容满足当前 schema/version/entrypoint contract
- **THEN** backend MUST 先解压到 managed staging directory
- **AND** MUST 原子替换 `<app-data>/web-assets/current`
- **AND** MUST 返回 `state=ready` 与匹配的 installed version

#### Scenario: Corrupt or unsafe archive is rejected
- **WHEN** checksum 不匹配、ZIP entry 存在 path traversal/symlink、manifest 无效、version 不匹配或 `index.html` 缺失
- **THEN** backend MUST 返回可定位的失败信息
- **AND** MUST NOT 激活 staging directory
- **AND** MUST NOT 破坏先前可用的 `current` directory

#### Scenario: Release download fails
- **WHEN** checksum 或 ZIP 请求超时、网络失败或返回非成功 HTTP status
- **THEN** backend MUST 返回 `state=failed` 和可重试错误
- **AND** MUST 清理本次 staging/download 临时文件

### Requirement: Local Daemon MUST Resolve Managed Web Assets Without Restart Coupling

本地 daemon Web Service runtime MUST 将 daemon `data_dir` 下的 managed `web-assets/current` 作为标准 asset candidate，并保留显式环境变量与 development/bundle candidates 的既有兼容性。

#### Scenario: Already-running daemon sees newly installed assets
- **WHEN** 本地 daemon 已运行且用户随后成功安装 managed Web assets
- **THEN** 下一次启动 Web Service 时 daemon MUST 从 `<data-dir>/web-assets/current` 解析 frontend root
- **AND** 用户 MUST NOT 被要求重启 desktop client 或 daemon

#### Scenario: Explicit override remains highest priority
- **WHEN** `MOSSX_WEB_ASSETS_DIR` 指向有效 frontend root
- **THEN** daemon MUST 优先使用该目录
- **AND** managed data directory candidate MUST 仅作为后续 fallback

#### Scenario: Development checkout fallback remains available
- **WHEN** managed assets 不存在但 daemon 运行于包含有效 `dist` 的 development checkout
- **THEN** daemon MUST 继续通过既有 candidate discovery 使用 checkout assets
- **AND** 本次变更 MUST NOT 改变 Web authentication、RPC routing 或 static response semantics

### Requirement: Release MUST Publish One Cross-Platform Web Assets Archive

Release pipeline MUST 每个 App version 构建并发布一次 platform-neutral Web assets ZIP 与对应 SHA-256 文件，且三个 desktop 平台 MUST 共用该产物。

#### Scenario: Release contains the installable assets contract
- **WHEN** Release workflow 为某个 App version 成功完成
- **THEN** Release MUST 包含 `ccgui-web-assets_<version>.zip` 与 `ccgui-web-assets_<version>.zip.sha256`
- **AND** ZIP root MUST 包含 `manifest.json`、`index.html` 与 Vite assets tree

#### Scenario: Web assets build failure blocks release publication
- **WHEN** frontend build、manifest creation、archive creation 或 checksum creation 失败
- **THEN** final Release job MUST NOT publish an incomplete Release
- **AND** pipeline MUST NOT silently omit Web assets artifacts
