# Proposal: fix-windows-cold-start-freeze-residual

> OpenSpec change id: `fix-windows-cold-start-freeze-residual`  
> Evidence anchor: `docs/analysis/windows-cold-start-click-freeze-and-uiscale-0.8-2026-08-07.md` §10  
> 关联历史：`optimize-cold-start-hydration-orchestration`、`fix-ui-scale-native-zoom-freeze-all-platforms`、`fix-windows-ui-scale-webview2-hang`

## Why

`optimize-cold-start-hydration-orchestration` 的 S0-S8 修复使 macOS 冷启点击完全稳定，但 **Windows (WebView2 + 125% DPI) 在冷启动 2 秒窗口内点击仍必现假死**。

现场诊断 analysis（§10.3）指向三条 WebView2 特定的连锁路径：
1. `apply(1)` 在冷启首帧**无条件**对 `<html>` + `<body>` 写入 20+ CSS inline 属性（zoom/width/height 等），迫使 Blink 在首帧同步重算布局
2. `blankScreenWatchdog` 每 1.5s 调 `getBoundingClientRect()` + `getComputedStyle()` 触发强制同步布局，与冷启 React reconciliation 叠加
3. `StartupGateOverlay` 的 `color-mix(in_srgb, …)` 需 GPU shader 计算，增加 compositor 开销

三道叠加使主线程在 0-2s 窗内持续繁忙，点击时 compositor hit-test 无法获取最新 layout tree → 阻塞 → 假死。macOS 的 WKWebView 不受同样影响（compositor 可用 stale 布局树，WebKit layout pass 更快）。

## 目标与边界

### 目标

1. **Windows 冷启 2s 窗口内点击不再假死**，与 macOS 体验对齐。
2. CSS 属性写操作只改有残留值的属性，冷启首帧零写入。
3. 白屏检测在冷启 gate 窗内不触发强制同步布局。
4. 降低 StartupGateOverlay 的 GPU compositor 成本。
5. 诊断文件在超出 byte budget 时首次加载即 trim，不再持续膨胀。

### 边界

- 仅改前端 UI/service 层；不改 Rust/Tauri。
- 不改冷启 hydration 编排逻辑（`optimize-cold-start-hydration-orchestration` 已完成）。
- 不改 `uiScale` 的 phase-2 延迟策略。
- 不引入新依赖。

## What Changes

| 文件 | 改动 |
|------|------|
| `src/utils/applyUiScale.ts` | `clearScaleLayoutStyles` / `setScaleLayoutStyles` 改为仅清除有残留值的属性 |
| `src/services/rendererDiagnostics.ts` | `startRendererBlankScreenWatchdog` 新增 `startDelayMs` 选项；`getPersistedDiagnosticsSnapshot` 首次加载时主动 trim |
| `src/bootstrapApp.tsx` | 传入 `startDelayMs: 15_000` 覆盖冷启 gate 窗口 |
| `src/features/app/components/StartupGateOverlay.tsx` | `color-mix()` → 分层 opacity（`bg` + `opacity: 0.92`） |

## Capabilities

### Modified Capabilities

- `client-startup-orchestration`: 新增冷启窗内禁止强制同步布局的约束（blankScreenWatchdog 延迟、CSS 属性写操作最小化），以及 overlay compositor 成本约束（禁止 `color-mix()` 等 GPU shader）。

## Impact

- Frontend: 4 files（见上表）
- Tests: `bootstrapApp.test.tsx` 的 mock assertion 对齐；`applyUiScale.test.ts` 的 transform/width 清除行为保持一致
- Docs: `docs/analysis/windows-cold-start-click-freeze-and-uiscale-0.8-2026-08-07.md` §10
- 无 schema / API / backend 变更

## 验收标准

1. Windows 125% DPI + `uiScale: 0.8` 冷启动，1s 内点击「展开加载日志」或 force-enter 后立即点击 UI → 不假死
2. macOS 冒烟：opacity 分层替代 color-mix 的视觉效果不退化
3. `diagnostics.json` 首次加载后 byte 不超过 256KB
4. 相关 Vitest 全绿
5. OpenSpec validate 通过
