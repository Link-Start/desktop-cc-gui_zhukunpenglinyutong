# Fix Linux Startup While Preserving Baidu Analytics

## Goal

在不关闭、不 mock 百度统计的前提下，修复 Linux native Tauri/AppImage 启动后只剩菜单栏/标题栏、content area 空白的问题。Linux 仍须产生真实 PV/UV，且 `hm.baidu.com` 网络请求不得进入已证明会在现场崩溃的 WebKit NetworkProcess/libsoup 路径。

## Requirements

- 关联 OpenSpec change：`fix-linux-startup-preserve-baidu-analytics`。
- 保留百度官方 `hm.js` 作为 payload authority，不在本地复刻私有 `hm.gif` 参数协议。
- Linux native production 通过 Rust `reqwest` 获取 fixed `hm.js`、发送 fixed `hm.gif`；script request 使用真实 WebView User-Agent + backend-owned fixed Tauri HTTP Referer；Windows/macOS/Linux Web Service 保留 existing external script behavior。
- official script 继续生成 `_hmt`、`hca`、screen/language/referrer 等字段；native transport 透传 WebView User-Agent。
- `HMACCOUNT` 以匿名 internal record 持久化，使用 existing storage lock + atomic write；日志不得包含 cookie value、完整 URL/query。
- backend command 必须 main-window-only、fixed endpoint/site-id、bounded input/response/timeout，禁止 generic proxy。
- analytics 任意失败均 best-effort，不阻塞 renderer bootstrap，不回退到 WebKit 百度请求。
- 不触碰 main worktree 的 `package-lock.json`/`.codegraph/` 或旧回退 worktree；真实 launcher 在验证隔离完成且用户明确授权后，只更新既有 wrapper 的单行 artifact path，不改 desktop entry id / GNOME favorite list 或其他用户系统配置。

## Acceptance Criteria

- [x] Frontend tests 证明 Linux native 调 native script/beacon bridge，仍初始化 `_hmt`，且不创建 external 百度 script；普通 Image 正常委托。
- [x] Backend tests 证明 invalid host/path/site id/hca/User-Agent 在联网前拒绝，并覆盖 Set-Cookie extraction 与 persistence continuity。
- [x] Rust native transport 真实获取 current `hm.js` 且 `hm.gif` 返回 2xx，不产生 WebKit crash。
- [x] isolated profile 连续两次启动均有 non-empty `hca`，第二次复用 visitor cookie（只记录 boolean）。
- [x] release ELF、AppImage direct 与 application-list-equivalent launch 均出现 render/ready markers，截图非白/黑/透明/ErrorBoundary-only。
- [x] 每次 launch timestamp 后无新增 `WebKitNetworkProcess`/libsoup crash。
- [x] focused/full tests、Rust tests、lint、typecheck、runtime contracts、build 和 OpenSpec consistency gate 通过；已证明无关的 baseline failure 按既有 waiver 单独记录。
- [x] independent review 无未解决的 P0/P1 finding，temporary probes/profiles/launchers/processes 已清理。

## Technical Notes

- 现场 versions：Ubuntu 22.04、WebKitGTK 2.50.4、libsoup 3.0.7；Apport core 为 `SIGSEGV` at `libsoup-3.0.so.0 + 0x4b1d5`。
- min harness 已证明：其他 HTTPS 正常；external/fetch-only `hm.js`、HTTP/HTTPS `hm.gif` 均崩；local `hm.js` + intercepted Image 正常并产生真实 beacon。
- 百度公开 Tongji API 是 report read API，不是公开的 Linux native/server-side PV ingestion API；PR 文案必须披露 native transport 的 compatibility risk。
- 当前首选 seam：同步安装 exact `Image.src` bridge后，fire-and-forget backend fetch/eval official script；script/beacon requests 在 Rust state 中串行维护 cookie。
- 用户已明确授权切换真实 launcher、push 并创建新 PR；delivery 仍须披露 compatibility boundary、baseline failures 与 unsigned local artifact。
