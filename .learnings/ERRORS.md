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
