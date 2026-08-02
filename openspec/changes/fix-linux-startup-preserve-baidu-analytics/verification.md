# Verification Evidence

## 结论

`fix/linux-startup-preserve-analytics` 已在 Ubuntu 22.04 / X11 / WebKitGTK 2.50.4 / libsoup 3.0.7 的真实 Linux Tauri 环境完成验证：百度统计没有关闭，official `hm.js` 仍生成 pageview payload；`hm.baidu.com` script/beacon transport 改由 narrow Rust `reqwest` path 承担后，release ELF、AppImage direct 与 application-list-equivalent `gtk-launch` 均渲染完整 UI，launch timestamp 后没有新增 WebKitNetworkProcess/libsoup crash。

用户已授权将真实 GNOME favorite 切到该 artifact，并按验证结果完成 commit / PR delivery。

## Implementation Contract

```text
official hm.js generates query
  -> Linux renderer intercepts exact hm.baidu.com/hm.gif Image.src
  -> Tauri commands with camelCase payload
  -> Rust fixed HTTPS reqwest transport
  -> validated HMACCOUNT lock + atomic persistence
```

- Linux native only；Windows、macOS、Linux Web Service 保留 external script path。
- Backend fixed endpoint/site id/method/Referer；main-window-only、HTTPS-only、no redirect、bounded input/response/timeout。
- `hm.js` 逐 chunk bounded read，status/size/site id/transport marker 通过后才 `eval`。
- network error 只输出 category；日志不包含 cookie value、完整 URL/query。
- corrupted/semantically invalid cookie JSON quarantine 后 fallback，不静默覆盖。

## Automated Verification

| Gate | Result |
|---|---|
| `npx vitest run src/services/baiduTongji.test.ts src/services/tauri/baiduTongji.test.ts` | PASS：2 files，9/9 tests |
| `cargo test --manifest-path src-tauri/Cargo.toml baidu_tongji::tests` | PASS：8/8 tests；其余 target 0 tests、filtered only |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS：0 errors；9 个既有 `react-hooks/exhaustive-deps` warnings |
| `npm run check:runtime-contracts` | PASS：app-shell + git-history contracts |
| `rustfmt --edition 2021 --check src-tauri/src/baidu_tongji.rs` | PASS |
| `git diff --check` | PASS |
| `npm run build` | PASS；仅既有 dynamic-import/chunk-size/CSS warnings |
| `npx -y @fission-ai/openspec@1.3.1 validate fix-linux-startup-preserve-baidu-analytics --strict --no-interactive` | PASS：change is valid |

## Real Native Transport

- Rust fixed-endpoint probe：`hm.js` HTTP 200、29894 bytes、expected marker present；`hm.gif` HTTP 200、response contains valid `HMACCOUNT`。
- Header A/B：缺失 HTTP Referer 时 script 为 `200 + empty body`；backend-owned `Referer: https://tauri.localhost/` 时取得 current non-empty official script。
- 当前 script 仍通过 `new Image().src` 发送 `hm.gif`；frontend 不构造 private query protocol。
- isolated profile run 1 / run 2 都观察到 script loaded 与 beacon accepted；第二次 log 为 `visitorCookiePresent=true`。
- WebView local storage 的 `Hm_lvt_<site-id>` length 从 48 增至 70，证明第二次启动再次执行 official script；native cookie file 在两次 checkpoint 内容一致，证明 visitor identity 复用。证据只记录 equality/length，不记录 identifier value。

## Release ELF Evidence

- `src-tauri/target/release/cc-gui` 在同一 isolated profile 连续启动两次。
- diagnostics 两轮均包含：
  - `bootstrap/render-committed`
  - `bootstrap/renderer-ready-marked`
- 两次窗口均为 1300×800；按 window id 截图人工复核为完整 UI。
- run 2 screenshot：3937 colors、opaque、非白/黑/透明/ErrorBoundary-only；显示 sidebar、首页 composer 与 version `v0.7.15`。

## AppImage And Launcher Evidence

- Artifact：`src-tauri/target/release/bundle/appimage/ccgui_0.7.15_amd64.AppImage`
- SHA-256：`cf3df07f6821323b5dea5b6983c5f6686992d25196cedfada3400701661f7b82`
- 普通 FUSE direct launch：PASS。
- temporary isolated `.desktop -> gtk-launch ccgui-final-analytics-test`：PASS。
- direct 与 gtk-launch 两张 1300×800 window-id screenshot 逐像素一致；共同 SHA-256：`0a3eb9514fdf45459ef5ac29e17f571ecdd51697bacab0d05b618b0eae4cb6ca`。
- 人工复核截图显示完整首页与 release-notes modal；不是白屏、黑屏或透明窗口。
- 真实 GNOME favorite `ccgui-native-clipboard-fix.desktop` 保持原 desktop entry id / favorite list，仅把既有 wrapper 的 `app_image` 切到本 artifact；`gtk-launch ccgui-native-clipboard-fix` 的 process environment 中 `APPIMAGE` / `ARGV0` 均指向本 artifact。
- 真实 launcher 的 window-id screenshot 为 1552×1043、6574 colors、opaque，人工复核显示完整 sidebar、首页 composer 与 `v0.7.15`；renderer diagnostics 同轮包含 `bootstrap/render-committed` 与 `bootstrap/renderer-ready-marked`，进程持续存活 47 秒后由验证脚本主动关闭。
- 同轮 real-profile `Hm_lvt_<site-id>` length 从 92 增至 114，native cookie file hash 保持一致：official script 再次执行且复用 visitor identity；证据不记录 identifier value。
- `build:appimage` 已生成完整可运行 artifact；wrapper 最后因环境没有 `TAURI_SIGNING_PRIVATE_KEY` 返回 non-zero，未伪报为 signed artifact。

## Crash Delta

- 验证窗口：2026-08-03 02:14:00 +08:00 至 03:21:37 +08:00，覆盖两次 release ELF、AppImage direct、temporary gtk-launch 与真实 GNOME favorite launcher。
- `journalctl` 未出现新的 `WebKitNetworkProcess` / `libsoup` / ccgui crash；只看到 AppImage temporary mount 正常 deactivation。
- `/var/crash` 同一时间窗没有新增文件。
- `coredumpctl` 不在本机 PATH，且项目要求的 zsh fallback 也不可用；因此 crash delta 以 journal + Apport `/var/crash` 为当前可执行 evidence boundary。

## Baseline Failures（已证明无关并获用户授权继续）

1. Full frontend suite 在第 19/246 batch 被 `src/features/app/components/Sidebar.test.tsx` 阻断：
   - `creates a new session directly inside a workspace session folder`
   - `moves codex pending folder intent after catalog-backed session exists`
   - worktree 与 untouched main 均为相同 `2 failed / 51 passed / 53 total`，均缺少同一 `codex-tui/default-config` menuitemradio；analytics change 未触及 Sidebar/provider catalog。
2. `npm run doctor:strict` 在 worktree 与 main 均先通过 runtime contracts，再被 existing branding gate 对既有 `mossx` identifiers 的命中阻断。
3. Full `cargo fmt -- --check` 在 worktree 与 main 均报告同一组 unrelated existing formatting diffs；新增 `src-tauri/src/baidu_tongji.rs` 的 targeted rustfmt check 通过。

## Review

- `check`：placement、type boundary、error handling、redaction、tests 与 command mapping 符合 frontend/backend quality specs。
- `check-cross-layer`：renderer routing → service wrapper → Tauri command registry → Rust validation/network → cookie storage 的 read/write path 完整；无 sibling runtime 遗漏。
- Reuse：复用 `detectRendererPlatform()`、`src/services/tauri/*` wrapper pattern、`storage::read_json_file/write_json_file/backup_corrupted_file`；没有新增 generic proxy/helper duplication。
- P0/P1：无未解决 finding。
- Compatibility risk：`hm.gif` transport 不是百度公开稳定的 server-side ingestion API；本实现继续运行 official browser script，只转发其 fixed transport。若 script marker/site id contract 变化，adapter fail closed，可能临时丢失 Linux analytics，但不会恢复已知 crash path。
- PR suitability：技术上适合提交；用户已明确授权 push 与创建新 PR。PR 必须披露上述 compatibility boundary、baseline failures 与 unsigned local artifact。

## Cleanup And Boundary Audit

- 已移除本 change 的 isolated profiles、temporary `.desktop`、window-id screenshots、WebKit probe binary/source、downloaded probe `hm.js`、test residue、`appimage_extracted_*`（无残留）与 worktree gitignored `node_modules` symlink；这些临时文件不可恢复，但都可重建。
- 没有残留 release ELF/AppImage/temporary launcher process。
- 已保留 verified AppImage，清理后 SHA-256 仍为 `cf3df07f6821323b5dea5b6983c5f6686992d25196cedfada3400701661f7b82`。
- Main worktree 仍只有用户原有 `M package-lock.json` 与 `?? .codegraph/`；本 change 未触碰。
- Old fallback worktree 仍只有其原有 `?? .codegraph/`；本 change 未触碰。
- Analytics-preserving worktree 只包含本 change 的 code/spec/task files，没有混入 main worktree 或 old fallback worktree 的既有改动。
- GNOME favorite 仍是 `ccgui-native-clipboard-fix.desktop`；desktop entry hash 与 GNOME favorite list 未变。既有 wrapper `/home/yode/.local/bin/ccgui-linux-startup-fix-appimage` 已只改一行 `app_image`，现在指向本 change 的 verified artifact。
- 真实 launcher 复核产生的两个 `/tmp/ccgui-real-launch-*.png` 已移除，测试窗口已主动关闭，无残留 AppImage/temporary launcher process。
