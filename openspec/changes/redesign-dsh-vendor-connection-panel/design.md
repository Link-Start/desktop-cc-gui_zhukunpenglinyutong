# redesign-dsh-vendor-connection-panel design

## Context

DSH 是 persistent Node host。mossx 作为第二 client，配置（key / provider / catalog）归 DSH Web UI。`add-dsh-engine` 已交付 supervisor（adopt / spawn）和设置薄面板，但面板把 Host / Port 当主界面，状态文案没接上。

原型：`docs/designs/dsh-vendor-settings/DSH Vendor Settings.html` 方案 A。

设置视觉基线：`docs/guides/ui/preference-settings-ui-guide.md`（preference row + 一块外壳）。

## Goals / Non-Goals

Goals：

- 第一屏是 host 活没活。
- 探测只信 `host.describe`，不 spawn。
- 「立即启动」显式走 `ensure_host`。
- 已连接 / 启动中可显式「关闭」本机 host；远程 origin 不杀。
- 自动启动开关只解释策略。
- Host/Port 收进连接设置。
- 状态卡按钮与标题左右分栏、靠右上，不压 `vendor-group-card` 分隔线。

Non-Goals：见 proposal。

## Decisions

### 1. 信息架构

```text
CliBrandHeader（安装/版本，沿用 CliLifecycle）
Ownership hint       ← 独立提示，不进状态卡
Status card          ← 主路径：标题+操作同一行
连接设置（可折叠）    ← Host+Port、自动启动、自定义路径
```

连接设置默认：

- 已连接 → 收起，摘要显示 `127.0.0.1:3080 · 自动启动开`
- 未运行 / 检测失败 / 用户改过地址 → 展开

### 2. 状态机

| 状态 | 条件 | 主操作 |
|---|---|---|
| checking | 尚无 doctor 结果，或刷新中且无缓存 | 无 |
| missing | `dsh --version` 失败 / doctor.ok=false 且无 version | 安装最新版（现有 lifecycle） |
| down | CLI 在，`host.describe` 失败 | 立即启动 + 仍尝试打开 + 重新检测 |
| connected | `host.describe` 成功 | 打开 DSH Web UI + 关闭 + 重新检测 |

探测失败不得报成「未安装」。

### 3. 探测 vs 启动

- **探测**：复用 `dsh_doctor`。doctor 已 probe `host.describe` 且 **never spawn**。前端解析 `hostDescribe`（ok / origin / describe / error）。
- **立即启动**：新 command `ensure_dsh_host` → `runtime_settings_for_explicit_start` + `ensure_ready`。关着自动启动也能被这个按钮拉起（按钮是用户显式意图，覆盖「下次自动」策略）。若 CLI 不在，返回可读错误，不假装成功。
- **关闭**：`cancel_dsh_host` → `stop_host`。取消 pending spawn；若配置的是本机 Host，再停掉该 port 上仍在应答 `host.describe` 的 listener（含 adopted）。远程 Host 返回可读错误，不杀。`drop_host`（mossx 退出）仍不杀 adopted。
- **打开 DSH Web UI**：仍 `openUrl(http://host:port)`，不要求先 connected（用户可能自己刚起）。
- **transport 文案**：`host.describe transport: error sending request for url (...)` 映射为 `dshDescribeFailed`，不把 reqwest 原文写进状态卡。

`dshAutoStart` 语义不变：只影响发送/会话链路的 `ensure_host`。设置页拨开关不 spawn、不杀进程。

Windows 探测：`find_cli_binary("dsh")` 额外扫 `%USERPROFILE%\.hermes\node[\bin]`、`%LOCALAPPDATA%\hermes\node[\bin]`、Scoop shims / nodejs current、mise shims、fnm 当前 shell 目录。GUI 进程 PATH 经常没有这些前缀。

### 4. host.describe 展示

只读 inline 元数据，缺字段就藏；不要做成三块灰底卡：

- `provider`
- `model`
- `attachedSessions`

禁止在 mossx 里改这些值。所有权说明作为状态卡上方的独立提示（「提示」标签 + 正文），不塞进状态卡。

### 5. 组件落位

- `src/features/vendors/components/DshConnectionPanel.tsx`：状态卡 + 连接设置
- `src/features/vendors/hooks/useDshHostStatus.ts`：doctor 探测 + ensure 启动
- `src/features/vendors/utils/dshHostStatus.ts`：纯函数映射 doctor → view model
- `src/services/tauri/dshHost.ts`：`ensureDshHost` / `cancelDshHost`
- 样式落在现有 `settings.part1.vendor-panels.css`，不另起主题。状态卡必须是单一子节点（`.dsh-status-main`），避免 `vendor-group-card > * + *` 在标题与正文之间画分隔线把按钮压住。按钮组放在 `.dsh-status-head` 右上，与标题对齐；事实行是无底 inline 元数据。

### 6. ADR

不命中基石文档更新触发器（不改 engine registry / Shared / provider binding / fact schema）。无需回写 `mossx-multi-cli-provider-session-foundation-design.md`。

## Risks

- doctor 类型目前没声明 `hostDescribe`：扩展为 optional，其他 CLI doctor 不受影响。
- 「立即启动」若忽略 `dshAutoStart=false`：必须在文案和 spec 写清「按钮是显式动作」。
- 设置页「关闭」会停 adopted 本机 host：这是用户显式杀配置 origin，不是退出副作用。远程地址必须拒绝。
- 设置页轮询 host 会打根链：只在 DSH tab active 时探测一次，刷新按钮手动重跑，禁止秒级轮询。
- CliLifecycle 版本条按引擎隔离（provider `key` + request-id + engine mismatch filter），禁止 Claude 的 `cli_version_status` 写到 DSH 头。
