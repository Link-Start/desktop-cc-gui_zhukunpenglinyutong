# redesign-dsh-vendor-connection-panel

## Why

设置 → CLI配置管理 → DeepSeek Harness 把 Host / Port / 自动启动当成主界面，真正要做的事——确认 host 活着、去 DSH Web UI 配模型和 Key——被挤成最后一行说明。

DSH 和 Claude / Codex 不是一类东西：模型和 API Key 永远在 DSH Web UI，mossx 只负责装 CLI + 连本地 host。现有薄表单让用户误以为要在 mossx 里加供应商，也接不上已有的 `dshHostDown` / `dshNotInstalled` 文案和 `host.describe` 结果。

方案 A（连接优先）已在 `docs/designs/dsh-vendor-settings/DSH Vendor Settings.html` 确认。

## What Changes

- DSH 引擎详情第一屏改为 host 连接状态卡：检测中 / 未安装 / 未运行 / 已连接。
- 已连接时只读展示 `host.describe` 的 provider / model / 会话数，主按钮是「打开 DSH Web UI」；同卡提供「关闭」以停本机 host。
- 未运行时提供「立即启动」——走现有 supervisor `ensure_host`，与发送链路同一套 adopt / spawn 规则。启动中也可点「关闭」取消 pending spawn。
- Host + Port 合并进可折叠「连接设置」；自动启动开关保留，文案写清「下次要用时的策略，不是当下动作」。
- `host.describe` transport 噪声映射成可读 i18n，不把 reqwest URL 原文甩到设置页。
- Windows 扫描 Hermes / Scoop / mise / fnm 常见 bin 位置，避免 GUI PATH 漏掉本机 `dsh`。
- 不在 mossx 里做 DSH 供应商表，不写 `$DSH_HOME` credentials。

## Capabilities

### New Capabilities

- `dsh-vendor-connection-panel`: CLI配置管理里 DSH 页的连接优先信息架构、状态探测、显式启动与所有权说明。

### Modified Capabilities

- `dsh-cli-lifecycle`: 设置页 MUST 区分 CLI 未装 / host 未运行；探测 MUST NOT spawn；显式启动 MAY spawn。

## Impact

- Affected code: `src/features/vendors/**`、`src/services/tauri/**`、`src/types/diagnostics.ts`、`src/styles/settings.part1.vendor-panels.css`、`src/i18n/locales/**/settings.ts`、`src-tauri/src/engine/dsh/**`、`src-tauri/src/command_registry.rs`、daemon 影子。
- APIs: 扩展 `dsh_doctor` 前端映射以读 `hostDescribe`；新增 `ensure_dsh_host`（显式启动，走 `ensure_ready`）与 `cancel_dsh_host`（取消 pending spawn 或停本机 listener）。
- Data: 不改 `dshBin` / `dshHost` / `dshPort` / `dshAutoStart` 语义。
- Compatibility: 未装 `dsh` 时仍显示 not-installed；已在跑的用户 host 仍可 adopt。设置页「关闭」是用户显式停本机 origin，远程 Host 不杀。退出 mossx 时 adopted host 仍不杀。

## 目标与边界

- 目标：方案 A 连接优先 UI，设置页能看见 host 真相。
- 边界：单机全局一个 host；配置归 DSH。

## 非目标

- 不在 mossx 添加 DSH provider / API Key / base URL。
- 不内嵌 DSH Web UI。
- 不改发送链路的 `dshAutoStart` 语义。
- 不把「立即启动」做成拨开关的副作用。
- 不把 mossx 退出时的 `drop_host` 改成杀 adopted host。
- 不做 Shared / Provider Continuation。
