# Proposal: fix-ui-scale-native-zoom-freeze-all-platforms

## 背景 / Why

2026-08-05 的 change `fix-windows-ui-scale-webview2-hang` 已证实：Windows WebView2
`SetZoomFactor(≠1)` 会拖死渲染进程（高 CPU + 内存暴涨至 GB 级），修复方案是
Windows 改走 CSS transform scale、native zoom 钉 1，**macOS / Linux 保留 native
`setZoom(uiScale)`**（当时判断 WKWebView / WebKitGTK 无 hang 证据）。

2026-08-06 新现场反馈（P0）推翻了这个边界：

1. **macOS 用户 `uiScale=0.9` 进入页面卡死** —— Mac 也走 native `setPageZoom(≠1)`，
   「Mac 正常」的旧结论只是样本不足。
2. **Windows 用户 App 内 100%、系统显示缩放 120% 也卡死** —— 现有理论（zoom API）
   无法解释，指向另有 fractional-scale 敏感点，需真机 profiling 继续查。
3. 两类用户共同痛点：**卡死发生在启动早期，进不了设置页改回 100%，每次启动都卡**，
   形成锁死循环，只能手动编辑 `settings.json` 自救。

## 变更 / What

1. **三端统一 CSS 缩放载体**：`applyUiScale` 对所有平台（windows / macos / linux /
   unknown）一律用 CSS `transform: scale()` + body `100/scale%` 布局补偿表达
   `uiScale`；native `setZoom` 全平台只钉 `1` 一次（清旧版残留）。**任何平台都不再
   调用 native zoom ≠1**。
2. **启动看门狗（startup guard）**：新增 `src/utils/uiScaleStartupGuard.ts`。
   非 100% 缩放被应用时向 localStorage 写 pending 记录；渲染器在 8s 内证明自己
   活着（rAF 触发）或 pagehide 干净退出则清除。下次启动发现残留记录 → 本次会话
   临时按 100% 启动（**不改写用户存储的设置**），并弹 runtime notice 告知。
3. **i18n**：`runtimeNotice.uiScale.startupGuardReset` 十语言。

## 非目标 / Non-goals

- 不改 `uiScale` 字段、0.8–2.6 产品范围、设置 UI。
- 不静默改写用户存储的 `uiScale`。
- 「Windows 100% + 系统 120% 卡死」案例的 fractional-DPR 根因排查不在本 change
  内（统一 CSS 后若仍复现，单独开 change 带真机 profiling 证据）。
- 不改 Tauri / wry 上游。

## 影响面 / Impact

- 代码：`src/utils/applyUiScale.ts`、`src/features/layout/hooks/useUiScaleShortcuts.ts`、
  新增 `src/utils/uiScaleStartupGuard.ts`；i18n 10 个 `runtimeNotice.ts`。
- 行为：macOS / Linux 的缩放渲染载体从 native page zoom 变为 CSS transform scale
  （视觉语义同为「界面 N%」）；Windows 无变化。
- 风险：CSS transform 路径在 WebKit 上的 fixed/拖拽/canvas 坐标表现需真机冒烟
  （同 v0.8.0 Windows 侧已接受的验收口径）。
