## ADDED Requirements

### Requirement: DSH vendor page MUST lead with host connection status

CLI配置管理里的 DeepSeek Harness 详情 MUST 把 host 连接状态作为第一屏，MUST NOT 把 Host / Port 输入当作主界面。

状态 MUST 为以下之一：`checking`、`missing`、`down`、`connected`。

#### Scenario: Host connected

- **WHEN** `dsh_doctor` 显示 CLI 已安装且 `hostDescribe.ok` 为 true
- **THEN** 页面 MUST 显示已连接，并展示 origin
- **AND** 若 `host.describe` 含 `provider` / `model` / `attachedSessions`，MUST 只读展示
- **AND** 主按钮 MUST 为打开 DSH Web UI
- **AND** MUST 提供「关闭」以停本机 host
- **AND** MUST NOT 提供添加 DSH 供应商的入口

#### Scenario: Host down

- **WHEN** CLI 已安装但 `hostDescribe.ok` 为 false
- **THEN** 页面 MUST 显示「主机未运行」
- **AND** MUST NOT 把该状态显示为「未安装」
- **AND** MUST 提供「立即启动」与「重新检测」

#### Scenario: CLI missing

- **WHEN** doctor 判定 DSH CLI 未安装
- **THEN** 页面 MUST 显示未安装
- **AND** 主路径 MUST 走现有 CLI 安装，而不是启动 host

### Requirement: Settings probe MUST NOT spawn the DSH host

打开或刷新 DSH 设置页时，状态探测 MUST 只走 `host.describe` / `dsh_doctor`，MUST NOT 因为进入该页而 `dsh web`。

#### Scenario: Open DSH tab while host is down

- **WHEN** 用户打开 DeepSeek Harness 页且本机 host 未运行
- **THEN** 系统 MUST 报告 down
- **AND** MUST NOT spawn `dsh web`

### Requirement: Explicit start MAY spawn even when auto-start is off

「立即启动」是用户显式动作。它 MUST 调用 supervisor `ensure_host` / `ensure_ready`，即使 `dshAutoStart` 为 false。

自动启动开关 MUST 只影响发送 / 会话链路的自动拉起，MUST NOT 在拨动当下 spawn 或杀死 host。

#### Scenario: Start host from settings with auto-start disabled

- **WHEN** host 未运行、`dshAutoStart` 为 false，用户点击「立即启动」
- **THEN** 系统 MAY spawn `dsh web`
- **AND** 成功后页面 MUST 重新探测并转为 connected（或展示 spawn 错误）

#### Scenario: Windows start uses a CreateProcess-safe launch

- **WHEN** 用户在 Windows 上点击「立即启动」且本机有 npm / Hermes 的 `dsh` 包装器
- **THEN** mossx MUST 通过 CreateProcess-safe 路径拉起 `dsh web`（优先 `node.exe` + `lib/bin.js`，否则 `cmd /D /S /C dsh.cmd`）
- **AND** MUST NOT 直接执行无扩展 POSIX shim（否则 os error 193 / `%1 is not a valid Win32 application`）
- **AND** 若 resolved DSH tree 里 `sharp/dist/constructor.mjs` 缺失或 0 字节、且 `constructor.cjs` 存在，MUST 先写 ESM re-export shim 再 spawn（Windows npm 会把该文件装成空文件，Mac 完整 tarball 不会）
- **AND** 若子进程在 `host.describe` 就绪前退出，MUST 把 stderr / 退出码带回设置页，不得只报 port occupied

#### Scenario: macOS start keeps the shebang launch

- **WHEN** 用户在 macOS 上点击「立即启动」
- **THEN** mossx MUST 直接执行已解析的 `dsh` shebang：`dsh web --host --port`
- **AND** MUST NOT 改写成 `node lib/bin.js`
- **AND** MUST NOT 把 child cwd 改成 `$HOME`
- **AND** MUST NOT 改写 `sharp/dist/constructor.mjs`
- **AND** 就绪超时 MUST 保持 20s

#### Scenario: Toggle auto-start

- **WHEN** 用户打开或关闭「自动启动主机」
- **THEN** 系统 MUST 持久化 `dshAutoStart`
- **AND** MUST NOT 立即启动或停止已有 host

### Requirement: Explicit stop MAY kill a local host

「关闭」是用户显式动作。启动中 MUST 取消 pending spawn。已连接且 Host 为本机地址时 MUST 停掉该 origin 上仍应答 `host.describe` 的 listener（含 adopted）。远程 Host MUST NOT 被杀。mossx 退出时的 `drop_host` MUST NOT 因此改为杀 adopted。

#### Scenario: Stop a connected local host

- **WHEN** 页面为已连接且 Host 为 `127.0.0.1` / `localhost` / `::1` / `0.0.0.0`，用户点击「关闭」
- **THEN** 系统 MUST 停止该 port 上的本机 DSH host
- **AND** 随后探测 MUST 转为 down 或 checking，不得仍显示已连接

#### Scenario: Stop refuses a remote host

- **WHEN** 配置的 Host 不是本机地址
- **THEN** 「关闭」MUST NOT 杀远程进程
- **AND** MUST 展示可读错误

### Requirement: Transport errors MUST be human-readable

状态卡 MUST NOT 原样展示 `host.describe transport: error sending request for url (...)`。该类错误 MUST 映射为 i18n `dshDescribeFailed`。

#### Scenario: host.describe transport failure

- **WHEN** doctor 返回含 `host.describe` / `error sending request` 的 transport 错误
- **THEN** 页面 MUST 显示「连不上本地 host」类文案
- **AND** MUST NOT 把完整 URL / reqwest 原文作为主错误

### Requirement: Status actions sit beside the copy without crossing a divider

状态卡 MUST 把文案与操作放在同一行容器内：操作靠右、相对整卡垂直居中、单行不换行。MUST NOT 让 `vendor-group-card` 的 sibling hairline 从按钮中间穿过。

#### Scenario: Connected card layout

- **WHEN** 状态为已连接
- **THEN** 「打开 DSH 设置」「关闭」「重新检测」MUST 在卡片右侧同一行
- **AND** 按钮 MUST 相对整卡垂直居中
- **AND** 按钮与卡片底部分隔线之间 MUST 没有压线

### Requirement: Connection settings are secondary

Host、Port、自动启动与自定义路径 MUST 放在「连接设置」分组。Host 与 Port MUST 同一行。已连接时该分组 MAY 默认收起。

#### Scenario: Connected user edits port

- **WHEN** host 已连接且用户展开连接设置并修改端口后失焦
- **THEN** 系统 MUST 保存 `dshPort`
- **AND** 页面 SHOULD 用新 origin 重新探测
