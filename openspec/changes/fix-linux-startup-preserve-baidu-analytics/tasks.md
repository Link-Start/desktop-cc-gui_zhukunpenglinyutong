## 1. Isolation And Native Probe

- [x] 1.1 [P0, depends: none] 在独立 worktree 核对 main/new/old-fallback boundaries、current source 与 project specs；输出 clean analytics-preserving branch 和未触碰 user changes 的证据。
- [x] 1.2 [P0, depends: 1.1] 用 WebKit harness 完成 single-variable minimization；输出 `hm.baidu.com` NetworkProcess request 为确定性 crash owner、local `hm.js` + intercepted Image 正常的 red/green 证据。
- [x] 1.3 [P0, depends: 1.2] 用 Rust `reqwest` fixed endpoint probe 获取真实 `hm.js`/`hm.gif` 2xx；结果为 script `200 / 29894 bytes / marker=true`、beacon `200 / HMACCOUNT=true`，并以 header A/B 证明 fixed Tauri HTTP Referer 为 non-empty script 必要条件；同一窗口无 WebKit/libsoup crash。

## 2. Contract And Regression Tests

- [x] 2.1 [P0, depends: 1.3] 新增 frontend failing tests；输入 Linux native/Web Service/Windows/development/main-window cases 与 matching/non-matching Image URL，输出 native load/beacon vs external script 的 exact routing。
- [x] 2.2 [P0, depends: 1.3] 新增 Rust failing tests；输入 valid/invalid endpoint、site id、hca、User-Agent、Set-Cookie 与 persisted record，输出 reject-before-network、identifier extraction 与 continuity contract。
- [x] 2.3 [P0, depends: 2.1,2.2] 增加 command registry/service mapping contract assertion；输出两个 command 的 camelCase payload 与 backend registration evidence。

## 3. Native Analytics Bridge

- [x] 3.1 [P0, depends: 2.2] 实现 fixed-endpoint Rust transport state；输出 bounded reqwest client、redacted error/status、serialized cookie access 与 lock+atomic persistence。
- [x] 3.2 [P0, depends: 3.1] 实现 main-window-only `load_baidu_tongji_script` 与 `send_baidu_tongji_beacon`；输出 official script eval、fixed HTTPS beacon、strict endpoint/site identity validation。
- [x] 3.3 [P0, depends: 2.1,3.2] 实现 Linux native frontend Image bridge 与 fire-and-forget load；输出 official `_hmt` behavior 保留、无 external WebKit request、failure 不阻塞 React boot。
- [x] 3.4 [P1, depends: 3.3] 保持 unaffected runtime parity；输出 Windows/macOS/Linux Web Service external script 与 development/secondary-window no-op tests。

## 4. Verification

- [x] 4.1 [P0, depends: 3.4] 运行 focused Vitest、Rust module tests、typecheck、lint、runtime contracts 与 OpenSpec consistency validation；输出 exact pass/fail 和 baseline exception classification。
- [x] 4.2 [P0, depends: 4.1] 构建 `custom-protocol` release ELF，用 isolated profile 连续启动两次；输出 official script/beacon 2xx、非空 `hca`、第二次 cookie reuse、renderer-ready、visible content 与 no-crash evidence。
- [x] 4.3 [P0, depends: 4.2] 构建并验证 AppImage direct + application-list-equivalent path；输出同一 artifact hash、非白/黑截图 pixel evidence、launch timestamp 后无 WebKit/libsoup crash。
- [x] 4.4 [P0, depends: 4.3] 运行 full tests/build/checks，清理 temporary probe/profile/launcher/process；输出 main/old-fallback/new worktree 与真实 launcher boundary audit。

## 5. Review And Delivery Decision

- [x] 5.1 [P0, depends: 4.4] 执行独立 code review、cross-layer check 与 finish-work；输出 findings 修复状态、private protocol compatibility risk 与 PR suitability。
- [x] 5.2 [P1, depends: 5.1] 更新 verification evidence 并向用户交付可运行 artifact/launcher plan；用户授权后切换真实 GNOME favorite、复核同一 artifact，并进入 commit / push / 新 PR delivery。
