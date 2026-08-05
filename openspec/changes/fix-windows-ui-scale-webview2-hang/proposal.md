## Why

Windows 本机冷启动在 `settings.json` 中 `uiScale ≠ 1`（典型 0.8）时，WebView2 渲染进程高 CPU/内存假死。根因是 `useUiScaleShortcuts` 无条件调用 `getCurrentWebview().setZoom(uiScale)`，落到 wry WebView2 `SetZoomFactor`。证据与机制见 `docs/analysis/windows-ccgui-startup-hang-2026-08-05.md`。

## 目标与边界

- Windows 上任意合法 `uiScale`（0.8–2.6）冷启动可交互，不因 native zoom 假死。
- 保留 `uiScale` 设置语义与快捷键 ± / 重置；不静默把用户值改成 1 写回磁盘。
- macOS / Linux 默认继续 native `setZoom(uiScale)`（WebKit 路径，无本 hang 证据）。
- 单测覆盖平台分支；OpenSpec change 可验证。

## 非目标

- 不改 Tauri/wry 上游。
- 不强制三端视觉像素级一致。
- 不在无 Linux 证据时把 Linux 改成 CSS zoom。
- 不重构 settings 持久化 / AppShell。
- 本 change **不自动 git commit**（用户要求本机修改、不提交）。

## What Changes

- 抽出 `applyUiScale`：按 `detectRendererPlatform()` 分平台应用缩放。
- Windows（及 unknown）：CSS `documentElement.style.zoom` + native `setZoom(1)` 钉死 ZoomFactor。
- macOS / Linux：清除 CSS zoom，native `setZoom(clampedScale)`。
- 更新 `useUiScaleShortcuts` effect 与单测。
- 新增 capability delta `client-ui-scale-platform-application`。

## 方案取舍

- **方案 A（采用）**：分平台——Win=CSS+native(1)；Mac/Linux=native(uiScale)。对准根因，Mac 行为不变。
- **方案 B（不采用）**：全平台 CSS。代码简单，但改变 Mac/Linux 行为且 WebKit CSS zoom 不稳。
- **方案 C（不采用）**：Windows 锁定 100%。止血过猛，产品回退。
- **方案 D（不采用）**：timeout 包 `setZoom`。无法阻止渲染进程失控。

## Capabilities

### New Capabilities

- `client-ui-scale-platform-application`: 桌面端 `uiScale` 必须按平台选择 CSS 或 native zoom，且 Windows 不得对 `uiScale≠1` 调用 WebView2 `SetZoomFactor`。

### Modified Capabilities

<!-- 无修改既有 capability；本行为此前未独立成 spec。 -->

## Impact

- Frontend: `src/features/layout/hooks/useUiScaleShortcuts.ts`、`src/utils/applyUiScale.ts`（新）
- Tests: hook + applyUiScale unit tests
- Docs: analysis report status
- Settings schema: 无字段变更

## 验收标准

- Windows：`uiScale:0.8` 冷启动可交互；`setZoom` 不得以非 1 调用（单测+策略）。
- macOS/Linux 路径单测：`setZoom(uiScale)` 仍发生。
- focused Vitest 通过；typecheck 通过。
- OpenSpec change artifacts 齐全；**不 git commit**（本轮）。
