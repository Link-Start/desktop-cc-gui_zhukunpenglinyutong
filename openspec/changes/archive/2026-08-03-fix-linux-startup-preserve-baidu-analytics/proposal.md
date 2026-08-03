## Why

`ccgui@0.7.15` 在 Ubuntu 22.04 / X11 / WebKitGTK 2.50.4 / libsoup 3.0.7 的真实 production 启动中会稳定出现空白窗口。最小 WebKit harness 已证明：任意由 `WebKitNetworkProcess` 发往 `hm.baidu.com` 的请求都会在现场 `libsoup-3.0.so.0 + 0x4b1d5` 触发 `SIGSEGV`；其他 HTTPS 请求正常，本地执行当前 `hm.js` 也正常，只有其 `hm.gif` transport 进入 WebKit NetworkProcess 时崩溃。此前“Linux native 跳过百度统计”的止血方案虽然恢复启动，但不满足产品要求，因为它关闭了 Linux 的 PV/UV。

## 目标与边界

- Linux native Tauri production 必须保留百度统计 PV/UV，同时不允许 `hm.baidu.com` 请求进入 WebKit NetworkProcess。
- 继续执行百度实时下发的 `hm.js`，保留其 pageview 参数生成、`_hmt` queue、screen/language/referrer 与 `hca` 语义；不自行维护一份私有 `hm.gif` 参数实现。
- 将 Linux native 的 fixed script fetch 与 fixed beacon send 转交 Rust `reqwest`，并持久化匿名 `HMACCOUNT`，避免每次启动都退化为新访客。
- Windows、macOS、Linux Web Service browser 与 development/secondary-window behavior 保持现状。
- analytics failure 必须 best-effort、可诊断且不能阻塞 React bootstrap 或重新造成空白窗口。

## 非目标

- 不关闭、mock 或延迟到永不执行百度统计；不改变 site id。
- 不把 `hm.gif` 描述成百度公开支持的 server-side ingestion API。当前 native bridge 只是对既有 browser script transport 的受限转发。
- 不升级系统 WebKitGTK/libsoup，不修改 proxy、display mode、PRIME、IME 或用户系统配置。
- 不新增通用 URL proxy，不允许 renderer 指定任意 host/path/method/header。
- 不修改 local Usage dashboard、Sentry policy、业务埋点口径或用户设置 schema。

## What Changes

- `src/services/baiduTongji.ts` 在 Linux native production 安装 exact `hm.gif` Image bridge，然后异步请求 backend 加载官方 `hm.js`；不创建 external `<script src="https://hm.baidu.com/...">`。
- 新增窄 frontend Tauri wrappers：一个加载固定 `hm.js`，一个发送固定 `hm.gif` beacon；两者都由 backend 二次校验。
- 新增 Rust analytics module，以 fixed HTTPS endpoints、bounded response、timeout、真实 WebView User-Agent、backend-owned Tauri HTTP Referer 和匿名 cookie persistence 执行 transport；command 只允许主窗口使用。实测百度对缺失 HTTP Referer 的 `hm.js` 请求返回 `200 + empty body`，固定 Referer 是取得官方脚本的必要 request fact。
- 增加 frontend/backend regression tests、runtime contract 与 Linux production artifact evidence。

## Capabilities

### New Capabilities

- `linux-native-baidu-analytics-stability`: 定义 Linux native 百度统计 transport、PV/UV identity persistence、startup isolation 与真实 artifact 验收。

### Modified Capabilities

- 无。既有 `linux-appimage-startup-compatibility` 处理 Wayland/EGL/GBM host fallback，本 change 处理 X11/Wayland 均可能发生的 renderer analytics network crash，责任边界独立。

## 方案比较

### 方案 A：官方 `hm.js` + native fixed transport（采用）

- 优点：保留官方参数生成与 `_hmt` 语义；WebKit 不访问百度；不需要维护私有 ingestion 协议；可持久化 UV cookie。
- 代价：需要一个受限 cross-layer bridge；若百度未来不再通过 `Image` 发送 beacon，必须 fail closed 并更新 adapter。

### 方案 B：Linux 跳过统计（拒绝）

- 优点：代码最少且启动可用。
- 缺点：直接丢失 Linux PV/UV，与明确产品要求冲突。

### 方案 C：Rust 自行构造整套 `hm.gif` query（拒绝）

- 优点：不执行远程脚本。
- 缺点：依赖未公开且易变的私有参数协议，screen/referrer/session/custom event 语义容易漂移。

### 方案 D：升级系统 WebKitGTK/libsoup（拒绝）

- 优点：可能从系统侧消除 crash。
- 缺点：超出应用修复权限，无法保证用户发行版版本，也不能作为 AppImage 自包含修复。

## 验收标准

- pre-fix Linux native production regression 会创建 external `hm.baidu.com` script/request；post-fix 只安装 native bridge，仍初始化 `_hmt` 并执行 backend-loaded official script。
- backend 必须拒绝错误 host/path/site id、超长 URL、非主窗口调用；禁止成为 arbitrary proxy。
- real native transport 必须取得当前非空 `hm.js` 且收到 `hm.gif` HTTP success；script request 必须带 backend-owned `https://tauri.localhost/` Referer，beacon 必须含 expected site id 与非空 `hca`，日志只记录 boolean/status，不记录 URL、query 或 cookie value。
- isolated profile 连续启动时，第二次请求必须复用已持久化的匿名 `HMACCOUNT`；持久化使用 lock + atomic write。
- direct release ELF、AppImage 与 application-list-equivalent launcher 均出现 renderer-ready/content markers、非空白可见内容，且 launch timestamp 后没有新的 WebKit/libsoup crash。
- focused/full frontend tests、Rust tests、lint、typecheck、runtime contracts、build 与 OpenSpec consistency validation 通过；已证明无关的 baseline failure 只按用户既有授权记录，不归因于本 change。

## Impact

- Frontend：`src/services/baiduTongji.ts`、focused test、`src/services/tauri/baiduTongji.ts` 与 aggregate export。
- Backend：新增 fixed-endpoint analytics module、command registry 与 app-managed transport state。
- Persistence：新增 internal anonymous cookie file under ccgui app home；无用户设置/API migration。
- Runtime：只改变 Linux native production analytics transport；其他 runtime 继续使用原 external script path。
- PR：用户已明确授权创建新 PR；PR 必须说明未关闭百度统计、Linux-native-only scope、private transport compatibility boundary、baseline failures 与 unsigned local artifact。
