## Why

当前 packaged client 不再携带 daemon 可直接读取的完整 Web frontend assets，导致用户启动 Web Service 后只能看到“资源不存在”占位页。需要在设置页提供一个最小、自解释的一键下载安装入口，让独立 Web assets 与主客户端包体解耦，同时恢复 Web Service 的可用闭环。

## 目标与边界

- Release 只额外发布一份跨平台 `ccgui-web-assets_<version>.zip` 与对应 SHA-256，不生成 `.pkg`、`.msi`、`.deb`。
- Web Service 设置页负责检测、下载安装和重新检测，用户无需执行命令或配置 `MOSSX_WEB_ASSETS_DIR`。
- GitHub artifact 尚未发布或离线时，允许用户显式选择同格式本地 ZIP 进行安装测试。
- Desktop Rust command 负责可信下载、checksum 校验、安全解压、内容验证与原子替换；React 只消费状态并触发动作。
- daemon 继续通过 `MOSSX_WEB_ASSETS_DIR` 使用 `<app-data>/web-assets/current`，不改变 Web Service RPC 与鉴权协议。

## 非目标

- 不构建通用组件市场、后台自动更新、多版本切换或下载进度系统。
- 不引入系统级安装器、管理员权限、系统卸载入口或 Linux 多发行版 packaging。
- 不改变远程 daemon 的资源管理；本次只管理当前 desktop client 所启动的本地 daemon。

## What Changes

- Release workflow 在前端构建完成后生成一次版本化 Web assets ZIP、manifest 与 SHA-256，并上传到同一 GitHub Release。
- 新增 Web assets 状态查询与安装 Tauri commands，返回稳定的 camelCase status contract。
- 安装流程使用临时目录，拒绝 ZIP path traversal，校验 archive checksum、manifest version 与 `index.html`，成功后原子替换 `web-assets/current`。
- Web Service 设置页新增资源状态、下载安装与重新检测操作；资源未就绪时禁用本地 Web Service 启动并显示可恢复提示。
- 设置页提供本地 ZIP 选择入口；backend 强制读取相邻 `.zip.sha256` 并复用网络安装的完整校验链。
- 本地 daemon bootstrap 使用检测通过的已安装目录，不再依赖从主程序 embedded assets 导出完整 frontend。

## 方案对比与取舍

- **采用：单一 Release ZIP + App Data 自管理安装。** 一份产物跨平台复用，不需要管理员权限，能完整覆盖当前“点按钮下载即可使用”的目标。
- **不采用：三平台系统安装器。** `.pkg` / `.msi` / `.deb` 会引入签名、提权、卸载和三套 packaging 维护，明显超过静态 assets 的需求。
- **不采用：继续从 Tauri embedded assets 导出。** 该路径把 Web Service 资源与主客户端 bundle 强耦合，且已出现 packaged layout 与长驻 daemon 分支不一致的问题。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `client-web-service-settings`: 增加 Web assets 检测、下载安装、安装完整性与本地 daemon 启动前置条件。

## Impact

- Frontend: `WebServiceSettings`、Tauri service mapping、i18n 与 focused Vitest。
- Backend: `src-tauri/src/web_service/**`、command registry、HTTP download/ZIP handling dependencies 与 Rust tests。
- Release: `.github/workflows/release.yml` 新增单一 Web assets archive/checksum 产物。
- Runtime: 本地 packaged daemon 的 `MOSSX_WEB_ASSETS_DIR` 来源改为验证通过的安装目录；development checkout fallback 保持不变。

## 验收标准

- 设置页能稳定区分 checking、missing、installing、ready、failed，并在 missing/failed 状态提供可重试动作。
- 当前版本 ZIP 下载、SHA-256 校验、安全解压和内容验证成功后，状态变为 ready，`index.html` 与 `assets/` 可读取。
- checksum 错误、非法 ZIP entry、manifest/version 不匹配或入口缺失时安装失败，既有可用目录不被破坏。
- Web assets 未 ready 时本地 Web Service 启动被阻止；ready 时本地 daemon 获得正确的 `MOSSX_WEB_ASSETS_DIR`。
- Release 中只出现一份跨平台 Web assets ZIP 及 checksum，三平台客户端共用同一下载地址规则。
