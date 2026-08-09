# Spec delta: client-startup-orchestration

> OpenSpec change: `fix-windows-cold-start-freeze-residual`  
> Capability modified: `client-startup-orchestration`

## ADDED Requirements

### CSS scale-styles must only clear residual values

`applyUiScale` 在写入 CSS 属性前必须先检查 inline 值是否已有残留。若属性值为空字符串（默认状态），不得写入空字符串——该操作在 Blink (WebView2) 中仍触发样式重算 + 布局无效化，冷启首帧写入 20+ 空值直接阻塞主线程。

- **Given** 冷启首帧 `<html>` 和 `<body>` 无任何 inline zoom/transform/width/height/position 值
- **When** `useUiScaleShortcuts` 的 effect 调用 `apply(1)`（phase 1 identity）
- **Then** `applyUiScale` 不得对值为空的 CSS 属性执行写入操作
- **And** `--ui-scale` CSS custom property 正常设为 `"1"`

### blankScreenWatchdog must defer during cold-start gate window

白屏检测 `startRendererBlankScreenWatchdog` 内部调用 `getBoundingClientRect()` + `getComputedStyle()` 触发强制同步布局。冷启 gate 窗内 `StartupGateOverlay` 全覆盖视口，白屏检测无用户价值，其强制布局却会与正在进行的 React reconciliation 竞争主线程。

- **Given** 冷启 gate 未 ready（`startup-gate-ready` 未 stamp）且 `StartupGateOverlay` 已渲染
- **When** `startRendererBlankScreenWatchdog` 的 interval callback 触发
- **Then** 首次检查必须延迟到 `startDelayMs` 之后（默认 15s，覆盖 gate-ready + force-enter + uiScale phase-2 天花板）
- **And** 延迟期间不采样、不写入诊断

### StartupGateOverlay must avoid GPU shader color-mix

`color-mix(in_srgb, var(--surface-messages) 92%, transparent)` 在 Chromium/WebView2 上需要 GPU shader 计算，增加 compositor 帧成本。冷启窗内 compositor 帧时间直接决定点击响应延迟。

- **Given** `StartupGateOverlay` 渲染全屏遮罩
- **When** 背景色需按主题变量 92% opacity 渲染
- **Then** 必须使用分层 opacity（独立的 `absolute` 背景 div + `opacity: 0.92`）替代 `color-mix()`
- **And** 背景 div 使用 `background-color: var(--surface-messages, #0d0f14)` 保持主题兼容

### Diagnostics persisted store must trim on load

诊断文件跨 session 累积可能超出 `MAX_PERSISTED_RENDERER_DIAGNOSTICS_BYTES`（256KB）。首次加载到内存缓存时检查 byte budget，超出则 trim 后写回。

- **Given** `getPersistedDiagnosticsSnapshot()` 首次从 store 加载诊断条目
- **When** 计算全部条目的 JSON 字节估算值 > 256KB
- **Then** 调用 `trimDiagnosticsToByteBudget` 裁剪后再缓存
- **And** 下次 persist 自动写入已裁剪的集合
