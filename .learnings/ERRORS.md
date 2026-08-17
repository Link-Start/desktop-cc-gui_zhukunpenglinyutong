# Command Errors

## [ERR-20260806-001] native_webview_zoom_freeze_lockout_loop

**Logged**: 2026-08-06T12:30:00+08:00
**Priority**: critical
**Status**: resolved
**Area**: frontend

### Summary

`uiScale≠1` 经 native zoom 接口（WebView2 `SetZoomFactor` / WKWebView `setPageZoom`）拖死渲染进程（高 CPU + 内存 GB 级暴涨），且卡死发生在启动早期、用户进不了设置页改回 100%，形成**每次启动都卡死的锁死循环**（P0，多平台多用户反馈）。

### Error

```text
现象: 设置「页面大小」≠100% 后进入页面假死；WebView2 renderer 数分钟 300MB→2GB+
最小复现(Windows): settings.json {"uiScale":0.8} → FAIL；{"uiScale":1} → PASS
根因代码: useUiScaleShortcuts effect 无条件 getCurrentWebview().setZoom(uiScale)（init 起存在）
```

### Context

- 三端共用一行 `setZoom(uiScale)`，默认「系统接口肯定靠谱」；实际 wry 三端后端完全不同（WebView2 / WKWebView / WebKitGTK）。
- 2026-08-05 修复仅覆盖 Windows（CSS scale + native 钉 1），Mac 凭「没接到投诉」被判正常；2026-08-06 Mac 0.9 卡死反馈推翻该结论——**没出过事 ≠ 安全**。
- 另有一例「Windows App 100% + 系统缩放 120% 卡死」超出 zoom API 解释范围，疑似 fractional-scale 敏感点，待真机 profiling 单独排查。

### Suggested Fix

1. 三端统一纯 Web 缩放载体：`applyUiScale` 全平台 CSS `transform: scale()` + body `100/scale%` 布局补偿，native `setZoom` 只钉 `1` 一次；**任何平台禁止 native zoom ≠1**。
2. 启动看门狗 `uiScaleStartupGuard`：非 1 缩放应用时 localStorage 留 pending；8s 内 rAF 证明活着 / pagehide 则清除；残留记录 → 下次会话临时按 100% 启动（不改写用户设置）+ runtime notice。
3. 规则沉淀：AGENTS.md「Native WebView API Gate」+ `.trellis/spec/guides/native-webview-api-risk-gate.md`（替代方案 / startup guard / 验收矩阵三问）。

### Metadata

- Reproducible: yes（Windows 数值矩阵全档复现；Mac 为现场反馈）
- Related Files: src/utils/applyUiScale.ts, src/utils/uiScaleStartupGuard.ts, src/features/layout/hooks/useUiScaleShortcuts.ts, docs/analysis/windows-ccgui-startup-hang-2026-08-05.md, openspec/changes/fix-windows-ui-scale-webview2-hang/, openspec/changes/fix-ui-scale-native-zoom-freeze-all-platforms/

### Resolution

- **Resolved**: 2026-08-06T12:30:00+08:00
- **Notes**: 代码已落地（focused vitest 32/32 + tsc + eslint 绿）；真机验收（Mac 0.9 / Win 0.8 / 看门狗模拟）交用户确认；「Win 100% + 系统 120%」悬案待单独排查。

---

## [ERR-20260715-001] focused_vitest_via_batched_wrapper

**Logged**: 2026-07-15T00:00:00+08:00
**Priority**: low
**Status**: resolved
**Area**: tests

### Summary

`npm run test -- --run <file>` cannot run a focused suite because the repository batch wrapper accepts only `--include-heavy`.

### Error

```text
Error: Unknown argument: --run
```

### Context

- Attempted focused verification for `useWorkspaceDropZone.test.ts`.
- `scripts/test-batched.mjs` owns the `npm test` entry and rejects Vitest passthrough arguments.

### Suggested Fix

Use `npx vitest run <test-file>` for focused suites; reserve `npm test` for the repository batch runner.

### Metadata

- Reproducible: yes
- Related Files: scripts/test-batched.mjs, package.json

### Resolution

- **Resolved**: 2026-07-15T00:00:00+08:00
- **Notes**: Switched focused verification to the repository's direct `vitest run` pattern.

---

## [ERR-20260720-001] zsh_reserved_status_variable

**Logged**: 2026-07-20T12:30:47+08:00
**Priority**: low
**Status**: resolved
**Area**: infra

### Summary

zsh 中 `status` 是只读特殊参数，不能用作 shell 校验脚本的普通退出码变量。

### Error

```text
zsh:2: read-only variable: status
```

### Context

- Claude CLI 卸载后的只读验证脚本尝试执行 `status=0`。
- 卸载命令此前已经完成；失败仅影响首次验证脚本。

### Suggested Fix

在 zsh 脚本中使用任务特定变量名，例如 `verify_exit_code`。

### Metadata

- Reproducible: yes
- Related Files: none

### Resolution

- **Resolved**: 2026-07-20T12:30:47+08:00
- **Notes**: 后续验证改用 `verify_exit_code`。

---

## [ERR-20260719-001] multi_file_apply_patch_anchor_mismatch

**Logged**: 2026-07-19T16:40:00+08:00
**Priority**: low
**Status**: resolved
**Area**: backend

### Summary

跨 desktop/daemon 相似分支的一次 multi-file patch 因错误假设两处 timeout 代码完全一致而被整体拒绝。

### Error

```text
apply_patch verification failed: Failed to find expected lines in
src-tauri/src/bin/cc_gui_daemon/daemon_state.rs
```

### Context

- 同时修改 Kimi async/sync send identity contract。
- Desktop 使用 `Duration::from_secs`，daemon sync 使用 `std::time::Duration::from_secs`。

### Suggested Fix

修改影子实现前先读取每个目标分支的精确上下文，并将跨文件 patch 拆成独立小块。

### Metadata

- Reproducible: yes
- Related Files: src-tauri/src/engine/commands.rs, src-tauri/src/bin/cc_gui_daemon/daemon_state.rs

### Resolution

- **Resolved**: 2026-07-19T16:41:00+08:00
- **Notes**: 重新读取 daemon sync 分支并拆分 patch。

---

## [ERR-20260814-001] windows_release_notes_close_freeze_on_cold_start

**Logged**: 2026-08-14T11:35:00+08:00
**Priority**: high
**Status**: resolved
**Area**: frontend

### Summary

Windows 安装最新版后自动弹出版本记录；启动后前几秒点叉号整窗假死，等约一分钟再点则正常。2s `setTimeout` auto-open 仍落在 cold-start 脆弱窗；关 overlay 同时拆掉全屏盾、卸载 Markdown、触发 first-click deferred hydrate。

### Error

```text
现象: 新装/升级弹出版本记录，立刻点叉号卡死；等 ~60s 再关不卡
根因: RELEASE_NOTES_AUTO_OPEN_DELAY_MS=2000 不读 startup-gate-ready；
      close 不取消 in-flight open；弹窗默认 FullMarkdownRuntime
```

### Context

- 仓库已有 cold-start click freeze / ComposerGate / 60s catalog freshness 结论；生产 StartupGateOverlay 默认关闭。
- 作者已预见到 freeze mid-modal，只把 lastSeen 提前，没有修卡死本身。
- 「等一分钟就不卡」对应 full-catalog 60s freshness/cooldown settle，不是 click unfreeze timer。

### Suggested Fix

1. auto-open 改为 `subscribeStartupGateReady` + `scheduleWhenInteractiveQuiet`，禁止用固定 timeout 当修复。
2. `closeReleaseNotes` bump generation，丢弃 late catalog resolve。
3. 弹窗 Markdown 走 `liveRenderMode="lightweight"`，去掉 backdrop-filter。

### Metadata

- Reproducible: field report (Windows); unit-covered for gate-ready / close-cancel
- Related Files: src/features/update/hooks/useReleaseNotes.ts, src/features/update/components/ReleaseNotesModal.tsx, src/styles/release-notes.css, docs/analysis/cold-start-click-freeze-postmortem-2026-08-10.md

### Resolution

- **Resolved**: 2026-08-14T11:35:00+08:00
- **Notes**: focused vitest 25/25 green. Windows 真机「新装立刻关弹窗」仍需用户确认。

---

## [ERR-20260814-002] windows_cold_start_permission_button_freeze

**Logged**: 2026-08-14T11:45:00+08:00
**Priority**: high
**Status**: resolved
**Area**: frontend

### Summary

Windows 进入页面后即使没有版本记录弹窗，快速点输入框「权限选择」(ModeSelect) 也会整窗假死。与关版本记录同一冷启动窗，但触发器是 ComposerGate 把早期 pointerdown 当成可以挂 ComposerImpl。

### Error

```text
现象: 冷启后立刻点权限模式 / 类似 composer chrome，整窗假死
根因: ComposerGate 旧条件「点过 + 静默 1.2s / 无人 2.8s」升 full
```

### Suggested Fix

Light 最短停留 6s；点过之后还须再静默 1.8s；idle 上限 8s。早期点击只推迟升级。

### Metadata

- Related Files: src/features/composer/utils/composerGateUpgrade.ts, src/features/composer/components/Composer.tsx, src/features/composer/components/ChatInputBox/selectors/ModeSelect.tsx

### Resolution

- **Resolved**: 2026-08-14T11:45:00+08:00
- **Notes**: ComposerGate upgrade helper unit-tested. Windows 真机「冷启立刻点权限按钮」仍需确认。

---

## [ERR-20260814-003] windows_any_first_click_deferred_hydrate_freeze

**Logged**: 2026-08-14T11:50:00+08:00
**Priority**: high
**Status**: resolved
**Area**: frontend

### Summary

Windows 冷启后点任意可见按钮都可能假死，因为第一次 pointerdown/keydown 会启动 deferred client stores + 完整 i18n + Baidu Tongji。这不是某个按钮的 bug，是公共 first-click 调度。

### Error

```text
scheduleIdleOrFirstInteraction(runDeferredStores / ensureI18nReady / baidu)
on first pointerdown/keydown during cold start
```

### Suggested Fix

改为 subscribeStartupGateReady 后再 idle，禁止用第一次点击当启动器。applyUiScale 恢复 verify-before-write，避免冷启无条件写空 inline。updater auto-check 同样等 gate-ready。

### Metadata

- Related Files: src/bootstrapApp.tsx, src/utils/applyUiScale.ts, src/features/update/hooks/useUpdater.ts

### Resolution

- **Resolved**: 2026-08-14T11:50:00+08:00
- **Notes**: bootstrap / applyUiScale / updater focused tests green.

---

## [ERR-20260814-004] composer_light_model_select_catalog_leak

**Logged**: 2026-08-14T11:55:00+08:00
**Priority**: high
**Status**: resolved
**Area**: frontend

### Summary

ComposerLight 故意不传 onExecutionTargetChange，指望 ReadinessBar 走静态模型位。ChatInputBox 却永远传入 truthy wrapper + useAtomicProviderTargetCatalog({ enabled: true })，冷启点模型位仍会打开 Radix ModelSelect 并 ensureProfiles/ensureModels。

### Suggested Fix

enabled 跟随真正的 onExecutionTargetChange；没有回调时不要把 wrapper / ensureProfiles / ensureModels 传给 ReadinessBar。

### Metadata

- Related Files: src/features/composer/components/ChatInputBox/ChatInputBox.tsx, src/features/composer/components/ChatInputBox/ComposerReadinessBar.tsx

### Resolution

- **Resolved**: 2026-08-14T11:55:00+08:00
- **Notes**: ComposerReadinessBar static-chip test green.

---

## [ERR-20260321-001] onboarding_i18n_missing_comma_transform_failed

**Logged**: 2026-03-21T12:00:00+08:00
**Priority**: high
**Status**: resolved
**Area**: frontend

### Summary

Vite/esbuild 启动失败：`src/i18n/locales/zh/onboarding.ts` 对象字面量缺逗号，报 `Expected "}" but found "subtitle"`。英文文件同一处也缺逗号，会在切语言后同样挂掉。

### Error

```text
[plugin:vite:esbuild] Transform failed with 1 error:
src/i18n/locales/zh/onboarding.ts:5:6: ERROR: Expected "}" but found "subtitle"
```

### Context

- 用户启动应用后 overlay 直接报 esbuild transform 失败。
- `welcome.title` 与 `done.enter` 两处字符串后缺逗号；中英文件结构相同。

### Suggested Fix

给对象属性补逗号，并用语法扫描覆盖 `src/i18n/locales/**/*.ts`，避免只修当前报错行。

### Metadata

- Reproducible: yes
- Related Files: src/i18n/locales/zh/onboarding.ts, src/i18n/locales/en/onboarding.ts

### Resolution

- **Resolved**: 2026-03-21T12:00:00+08:00
- **Notes**: 中英 `welcome.title` / `done.enter` 已补逗号，`node --check` 与 locales 扫描通过。

---
