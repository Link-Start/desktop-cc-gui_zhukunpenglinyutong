## Why

Windows 外观设置把「页面背景 / 流体背景」整段隐藏，工作台与 first-run 一律跳过 WebGL。这是 2026-08-17 的兼容性止血（`skip Windows fluid`），不是产品终态。现在要解禁入口，并在本机把真正的 WebView2 / ANGLE 兼容问题修掉。

## 目标与边界

### 目标

- Windows Settings → 基础 → 外观重新展示页面背景三选一（流体 / 不要背景 / 自定义）以及流体配色、动势、毛玻璃。
- Windows 选流体后必须真正挂 WebGL2 canvas，不得再被平台门禁改写成 `none` 或实色层。
- first-run 与工作台共用同一条 `attachFluidShader`；Windows 不再走 `data-solid` 短路。
- WebGL2 / compile 失败仍静默回退 CSS 底，不得挡住设置页或向导。
- WebView2 对 `desynchronized` 等 context flag 过敏时，必须降级重试拿得到 context。

### 边界

- 不把 wallpaper 状态塞进 AppShell domain bag。
- 不新开第二条 GPU 管线，不改动势语义。
- 不改默认 `mode: none`：解禁不是默认开流体。
- 不改窗口透明度 / native zoom。
- 本 change **不自动 git commit**（交用户验收后提交）。

## 非目标

- 不做 Windows 专属第二套视觉。
- 不把自定义图复制进 app data。
- 不在本轮 archive 无关 change。

## What Changes

| 区域 | 变更 |
|------|------|
| `workspaceWallpaper` | 删除 Windows 硬门禁；`resolveWorkspaceWallpaperMode` 三端同语义 |
| Settings 外观 | Windows 重新展示页面背景整段 |
| `FirstRunFluidBackdrop` | 去掉 `solidOnly`，Windows 挂 canvas |
| `fluidShader` | WebView2 context 降级重试；compile/link 失败打诊断 |
| Tests / OpenSpec | 反转 Windows hide 断言；delta 去掉「Win 必须隐藏」 |

## Capabilities

### New Capabilities

- 无

### Modified Capabilities

- `workspace-wallpaper`：Windows 与其它平台共用同一套页面背景入口与 fluid 渲染；失败走既有 CSS fallback，不再平台级隐藏。

## 验收标准

1. Windows 设置外观能看到「页面背景」，可选流体 / 不要背景 / 自定义。
2. 选流体后主窗口挂 wallpaper 层与 canvas；重启后仍保持。
3. first-run 在 Windows 不再只画实色底。
4. WebGL2 不可用或 shader compile 失败时，页面仍可用，设置可改回「不要背景」。
5. focused vitest 覆盖 sanitize / host / settings / first-run；Windows hide 用例改为可见且可渲染。

## Impact

| 层 | 影响 |
|----|------|
| Frontend feature | wallpaper host + first-run backdrop + settings appearance |
| WebGL | context 获取与诊断，不改场语义 |
| CSS | 去掉 Windows 专用 solid 短路依赖 |
| OpenSpec | 本 change + `workspace-wallpaper` delta |
