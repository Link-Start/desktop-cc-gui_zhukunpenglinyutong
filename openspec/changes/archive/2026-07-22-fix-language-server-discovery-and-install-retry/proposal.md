## Why

macOS GUI app 与 Terminal 的 `PATH` 隔离，导致用户已通过 Homebrew 安装 `jdtls`，客户端仍把 provider 判为 unavailable。当前 fallback 提示还缺少安装后的就地重新检测闭环。

## 目标与边界

- Language Server discovery 复用现有 cross-platform CLI resolver，覆盖 macOS Homebrew、Windows wrapper/user directories、Linux standard/user directories。
- provider child process 获得同一 extended `PATH`，避免 launcher 已找到但其 `java`/`node` dependency 再次丢失。
- `provider-unavailable` 提示明确显示 current OS、建议安装命令、copy action 与“安装完成后重新检测”。
- 所有工作只在 explicit navigation query 时发生，不新增 polling、root state 或 editor hot-path work。

## What Changes

- 修复 Java、TS/JS、Rust semantic provider executable resolution 与 child `PATH`。
- 保持 `MOSSX_*_LANGUAGE_SERVER_BIN` override 最高优先级。
- 扩展 fallback note，安装命令始终可见并可复制，安装后可直接 retry 当前 navigation action。
- 增加 cross-platform resolver、macOS Java hint 与 retry focused tests。

## 非目标

- 不自动执行安装命令，不修改用户 shell profile、PATH 或系统配置。
- 不新增 Settings installer、后台状态探测或自动下载。
- 不改变 semantic query、fast-search fallback 与 editor typing/render path。

## 方案对比

1. **复用 extended CLI resolver（采用）**：已有 macOS/Windows/Linux 搜索目录与 wrapper 处理，最少重复并能覆盖 Java/Node/Rust 工具链。
2. 仅硬编码 `/opt/homebrew/bin/jdtls`：能修当前机器，但 Windows/Linux、Intel Mac、TS/Rust 仍失效。
3. 只要求用户配置 environment override：工程成本低，但普通用户无法闭环，且 Finder 启动仍容易失败。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `semantic-code-navigation-provider`: provider discovery 与 child environment 必须兼容 desktop GUI process。
- `file-view-code-intelligence-navigation`: unavailable 提示必须包含安装命令和安装后重新检测入口。

## Impact

- Backend：shared CLI path resolver reuse、semantic provider spawn。
- Frontend：navigation fallback note、localized copy、focused tests。
- API/dependencies：无新增 dependency，无 payload breaking change。

## 验收标准

- `/Applications/*.app` 风格 GUI PATH 不包含 Homebrew 时，仍能发现 `/opt/homebrew/bin/jdtls`。
- macOS/Windows/Linux provider command 使用 extended PATH，Windows `.cmd/.bat` 继续可启动。
- provider unavailable 时提示框显示 OS、安装命令、复制与重新检测；timeout 等非安装问题不显示。
- 安装 provider 后无需重启 app，点击重新检测即可再次发起 semantic query。
- focused frontend/Rust tests、typecheck、targeted lint、strict OpenSpec validation 通过，不运行全量测试。
