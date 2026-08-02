## Context

现场 min harness 给出了可重复的分层结论：`tauri://` 页面不联网稳定，其他 HTTPS script 稳定；external `hm.js`、仅 `fetch(hm.js)`、HTTP/HTTPS `hm.gif` 都会触发同一个 WebKit internal error 和 libsoup crash；把同一份 `hm.js` 本地执行并拦截 `Image.src` 后 renderer 稳定且能抓到完整 beacon。因此 JavaScript/React 不是这个确定性故障的 owner，`WebKitNetworkProcess -> libsoup -> hm.baidu.com` 才是。

百度公开 Tongji API 文档覆盖报告读取，不提供公开 Linux desktop/server-side PV ingestion contract。本设计不能声称改用“百度官方 server-side API”；它继续运行官方 browser script，只把其 fixed network transport 搬到 native HTTP client。

## Goals / Non-Goals

**Goals:**

- 保留 official `hm.js` 作为 analytics payload authority，避免参数实现漂移。
- 在 Linux native renderer 安装 beacon bridge 后再执行脚本，保证 `hm.baidu.com` 不进入 WebKit NetworkProcess。
- 保持 `HMACCOUNT` 与 script-owned `hca` 跨启动稳定，保留 PV/UV 基本语义。
- native network failure 不影响 app bootstrap，并留下不含 identifier 的可诊断 evidence。
- command surface 必须 narrow、bounded、main-window-only、site-id-locked。

**Non-Goals:**

- 不保证百度 dashboard 的最终聚合时延；验收以 official endpoint HTTP success、identifier continuity 与本地 transport evidence 为边界。
- 不新增 analytics opt-out/settings surface，不改变其他平台统计政策。
- 不支持 renderer 代理任意 analytics provider、URL、header 或 request body。
- 不在本 change 修复其他不可重复的 React/update-loop hypothesis。

## Decisions

### 1. Runtime routing 只在 Linux native production 分叉

`installBaiduTongji` 保留 production + main-window gate。Windows、macOS 与 `window.__MOSSX_WEB_SERVICE__ === true` 继续创建原 external script。只有 `detectRendererPlatform() === "linux"` 且非 Web Service 时：

1. 初始化既有 `_hmt` queue；
2. 同步安装 exact `http(s)://hm.baidu.com/hm.gif` Image bridge；
3. fire-and-forget 调用 `load_baidu_tongji_script`；
4. backend 取回官方 script 后在同一主 WebView context 执行。

Image bridge 对非 matching URL 完整委托 native `Image`。bridge 在 page lifetime 内保留，确保后续 `_trackEvent`/queue flush 仍走 native transport。若 bridge 安装或 script load 失败，记录 bounded warning 并停止本次 analytics，不回退 external WebKit request。

### 2. Official script 仍是 payload authority

backend 固定获取 `https://hm.baidu.com/hm.js?<site-id>`，限制 status、content length、timeout，并要求响应仍包含 expected site id transport marker 后才执行。native probe 证明百度对没有 HTTP Referer 的请求返回 `200 + 0 bytes`，而只增加 `Referer: https://tauri.localhost/` 即恢复当前 29894-byte JavaScript；因此 script fetch 使用 backend-owned fixed Tauri HTTP Referer，不接收 renderer 自定义 referer，也不携带 workspace/session/path。script 继续读取真实 `window`、screen、language、document/referrer/local storage 并生成 `hca/si/ds/cl/ln/...`；frontend 不复刻 query。

当前官方 script 的发送 seam 是 `new Image().src = hm.gif URL`，已由 min harness red/green 证明。若 future script 不再包含这一 transport marker，backend MUST refuse evaluation rather than expose an unguarded WebKit request；这会临时丢失 analytics，但保持 startup availability，并要求后续 adapter update。

### 3. Beacon command 只接受 fixed endpoint identity

`send_baidu_tongji_beacon(url, userAgent)` 在 frontend 与 backend 双重筛选；backend authoritative validation：

- input size bounded；scheme 只接受 `http/https`，发送时统一 upgrade 到 HTTPS；
- host exact `hm.baidu.com`、port absent/default、path exact `/hm.gif`；
- query 中 `si` exact matching built-in site id，`hca` non-empty；
- request method 固定 GET，不接受 caller headers/body；User-Agent 仅允许 bounded、无控制字符字符串。

允许百度新增 query field，以免 strict field allowlist 让官方脚本升级后静默丢统计；fixed host/path/site id/method/size 已保证 command 不是 arbitrary URL proxy。

### 4. UV continuity 同时保留 client `hca` 与 server `HMACCOUNT`

官方 `hm.js` 继续在 renderer storage 中生成/读取 `HMACCOUNT` fallback 并把其 client id 写入 `hca` query。native transport 另外捕获 `hm.baidu.com` response 的 `Set-Cookie: HMACCOUNT=...`，只接受 bounded token value，并保存到 ccgui app home 的 internal analytics JSON。

每次 fixed script/beacon request 只在短 async mutex 内 clone cookie snapshot，network I/O 在锁外执行。response status、bounded body、UTF-8、site id / transport marker 等对应校验全部成功后，backend 才按 request snapshot compare-and-update；若 state 已被另一有效响应更新，则 stale response 不得覆盖 newer identity。accepted update 通过独立 commit mutex 串行化，使 in-memory update 与既有 `with_storage_lock + write_json_file` atomic persistence 保持相同顺序；`visitor_cookie` mutex 不覆盖 network 或 persistence I/O。日志只允许 `visitorCookiePresent=true/false`，不得输出 value、query 或完整 URL。corrupted persistence 必须 quarantine 后回到 empty identity，不允许覆盖原文件。

首次迁移到 native transport 可能获得一次新的 server cookie；之后 native launches 保持稳定。`hca` 仍由原 WebView profile 延续，因此不把这一有限迁移风险表述成完全无统计断点。

### 5. Analytics 是 best-effort side effect，不是 bootstrap gate

`installBaiduTongji()` 保持同步返回；native load Promise 不被 `main.tsx`/React boot await。Rust 为 connect/total request 设置 bounded timeout。任何 DNS/TLS/HTTP/persistence/eval failure 都只终止 analytics path并输出 redacted diagnostic，不能 throw 到 bootstrap、ErrorBoundary 或重试循环。

成功 evidence 仅记录 fixed script loaded、beacon HTTP status、`hasHca`、`visitorCookiePresent`。不记录 session URL、referrer、screen payload 或 anonymous identifier value。

## Cross-Layer Contract

### Signatures

- Frontend service：`loadBaiduTongjiScript(userAgent: string): Promise<void>`
- Frontend service：`sendBaiduTongjiBeacon(url: string, userAgent: string): Promise<void>`
- Tauri command：`load_baidu_tongji_script(user_agent: String, webview, state) -> Result<(), String>`；fixed Referer 由 backend 注入，不是 IPC field。
- Tauri command：`send_baidu_tongji_beacon(url: String, user_agent: String, webview, state) -> Result<(), String>`；fixed Referer 由 backend 注入。
- Persisted internal record：`{ "hmacCount": string }`；field optional on read, validated before use。

### Error Matrix

| 场景 | 行为 | Startup |
|---|---|---|
| development / secondary window | no analytics | unaffected |
| Windows/macOS/Web Service production | existing external script | unchanged |
| Linux native valid script + beacon | real User-Agent + fixed Tauri Referer native fetch/eval/send + cookie persist | boot proceeds concurrently |
| invalid URL/site id/hca/user agent | command rejects before network | boot proceeds |
| DNS/TLS/timeout/non-2xx 或 script validation failure | redacted warning, no cookie commit, no WebKit fallback | boot proceeds |
| cookie file missing | empty visitor cookie, persist response | boot proceeds |
| cookie file corrupted | quarantine, empty visitor cookie | boot proceeds |
| official script transport marker changes | refuse eval, diagnostic | boot proceeds without unsafe request |

### Good / Base / Bad Cases

- Good：official script 生成 `hca`，Image bridge 捕获 fixed beacon，Rust 以 persisted cookie + real User-Agent 发送并收到 2xx。
- Base：离线启动，analytics warning 可见但 renderer 正常 ready。
- Bad：Linux native 直接 append external `<script>`；Linux return 跳过统计；command 接受 arbitrary URL；日志打印 cookie/query。

## Risks / Trade-offs

- [Risk] remote `hm.js` 改变 transport → marker validation fail closed，保启动并产生 actionable diagnostic；不盲目执行可能绕过 bridge 的脚本。
- [Risk] global `Image` wrapper 影响其他图片 → exact URL 才拦截，其他 constructor/property behavior delegate；focused test 覆盖普通 image。
- [Risk] anonymous cookie persistence 被误当 credential → 单独 internal file、atomic write、无日志 value；它只用于统计 visitor continuity。
- [Risk] native HTTP 与 WebKit network stack 的 proxy/CA behavior 不同 → bounded failure，不回退 WebKit；真实 AppImage 在用户现场网络验证。
- [Trade-off] 首次迁移可能重置 server-side `HMACCOUNT`，但 WebView-owned `hca` 继续；后续启动 cookie 稳定。相比每次禁用 Linux 统计，这是可控且可验证的有限影响。
- [Compatibility] fixed `hm.gif` transport 不是百度公开稳定的 server-side API；PR/design 必须持续披露这一事实。

## Migration Plan

1. 建立 Rust native fixed-script probe，确认 reqwest 在 real User-Agent + fixed Tauri Referer 下取得 `hm.js 200/29894 bytes`、`hm.gif 200/HMACCOUNT`，且不产生 WebKit crash。
2. 先写 frontend/backend red tests，锁定 runtime routing、URL validation、identifier/cookie contract。
3. 实现 state、commands、bridge 与 persistence；运行 focused/full gates。
4. 使用 isolated profile 连续启动 direct ELF，再构建/启动 AppImage 与 application-list-equivalent path；检查真实 network success、cookie reuse、renderer markers、截图与 crash delta。
5. 独立 review 与 cleanup；在用户明确授权后切换真实 launcher、复核同一 artifact，再 commit / push / 创建新 PR。

Rollback 回退本 change 的 frontend native branch/backend module即可；其他平台 external path 不变。若必须临时止血，可继续使用旧本地回退分支，但不得把“Linux 统计关闭”提交为本 change 完成态。

## Open Questions

- 百度 dashboard 是否会把 native HTTP User-Agent + original `hca` 完全聚合到原 UV，只有 dashboard owner 才能最终观察；本 change 的可自动化边界是请求 success、identifier continuity 和 cookie reuse。
