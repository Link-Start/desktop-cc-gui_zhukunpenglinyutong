## Why

「CLI配置管理」详情 header 目前只展示引擎标题与文档入口，用户看不到本机 CLI 版本，也无法直接安装 / 升级 / 卸载。版本探测与 one-click installer 已在「运行环境 → CLI 验证」落地，但配置管理页缺少可发现入口。

本变更把受控 lifecycle 动作接到 VendorSettings 的 Claude / Codex / Kimi brand header，并补齐「仅有更新时显示升级」所需的 registry outdated 探测。

## 目标与边界

### 目标

- 在 CLI配置管理 header 右侧展示本机版本（未安装显示未安装态）。
- 未安装提供安装；已安装提供卸载；仅当 npm registry 最新版大于本机版时提供升级。
- 安装 / 升级 / 卸载复用现有 install plan 确认 + 实时日志流程。
- 成功后刷新 version status / doctor 相关状态。

### 边界

- 只覆盖 Claude / Codex / Kimi；不扩展到 unsupported 引擎。
- 升级 visibility 基于白名单 `npm view <pkg> version` + semver 比较；探测失败不得误显示升级。
- 不改变左侧绿点语义（仍表示 hasConfig，不表示已安装）。
- 不启用 CLI self-update 策略；仍只用 npm global `@latest`。
- 不在 header 做完整 doctor 诊断面板。

## What Changes

- 扩展 `cli-one-click-installer`：增加只读 `cli_version_status` 与 VendorSettings header lifecycle 入口契约。
- 后端新增 registry latest + local version 状态查询。
- 前端抽取共享 install lifecycle hook，并在 VendorSettingsPanel brand header 挂载 actions。

## Capabilities

### Modified Capabilities

- `cli-one-click-installer`: 增加 version status 与 VendorSettings header lifecycle 行为。

## 验收标准

- Claude / Codex / Kimi 详情 header MUST 展示 local version 或未安装态。
- 未安装 MUST 显示安装；已安装 MUST 显示卸载；仅 `updateAvailable=true` 时 MUST 显示升级。
- `npm view` 失败或无法解析 semver 时 MUST NOT 显示升级。
- 点击安装 / 升级 / 卸载 MUST 先展示 install plan 并等待确认。
- 执行成功后 MUST 刷新 header version status。
