# WebView Animation Compat Pitfall（动效 / WebGL 跨 WebView 兼容采坑）

> 来源事故：2026-08-19 Windows 工作台流体背景。平台门禁把整段「页面背景」藏掉当兼容性修复；解禁后 WebView2 / ANGLE 上后四档动势看起来仍是第一档、或整窗发黑像丢了 CSS、或冻成静图。
> OpenSpec：`openspec/changes/enable-windows-workspace-wallpaper/`。
> 对照实现：`src/features/onboarding/utils/fluidShader.ts`、`src/features/theme/components/WorkspaceWallpaperHost.tsx`、`src/styles/workspace-wallpaper.css`。
> 本文件是 **implementation rule**。Mac 已经能用的路径禁止被 Windows 兜底改写。

## 事故三段论（背下来）

1. **直接原因**：WebView2 / ANGLE ≠ Mac Metal / WKWebView。同一条 WebGL2 + CSS 在 Mac 正常，在 Windows 上会：忽略 mega-shader 的 `u_motionMode` 分支、首帧后再 compile 失败或丢 context、`backdrop-filter` 盖住 canvas 合成黑底、`prefers-reduced-motion` 误报把 RAF 停死。
2. **放大原因**：chrome 被 `data-workspace-wallpaper` 打成 16% 透明，假定后面有一张活的画。canvas 黑着或没 attach，用户看见的是「样式丢了」，不是「shader 挂了」。
3. **流程原因**：用 `isWindowsPlatform()` **整段隐藏入口** 当止血；解禁后又把 Windows 兜底写进三端共用默认路径，差点把 Mac 已正确的 frost / reduced-motion / chase 预编译改坏。

浏览器里打开的 `docs/designs/**` 原型能跑，**不等于** Tauri WebView2 能跑。验收以开发者客户端（isolated `ccgui-dev`）为准。

## 已证实模型（不要再重新发明）

| 现场 | 根因 | 证据分级 |
|------|------|----------|
| 后四档切了还是第一档流动 | 一条 mega-shader + early return / `u_motionMode` 分支，ANGLE 不走结构化场 | 已证实（Win） |
| 整窗发灰发暗、浅色字看不见 | `backdrop-filter` 盖 WebGL 合成黑底 + 透明 chrome 打孔 | 已证实（Win） |
| 换芯片不变、完全不流动 | RAF 被 `prefers-reduced-motion` 停掉，且 `setParams` 不重画 | 已证实（Win） |
| 挂载后 canvas 一直黑 | 启动同步编译过大 chase program，ANGLE 丢 context | 已证实（Win） |
| Mac 流体 / 毛玻璃 / 五档 | 原路径可用 | 已证实（Mac），禁止回写 |

**已排除**：Windows「根本没有 WebGL2」（context 降级后拿得到）；设置没写入 `fluidMotion`（chip 与 store 是通的）。

## 硬红线（Forbidden）

1. **禁止用平台隐藏当兼容性修复。**
   `if (windows) 不渲染入口 / mode 强制 none` 只许当临时止血，必须带 OpenSpec 与解禁条件。失败走运行时 fallback（no-op handle + CSS 底），不要把功能从设置里抹掉。
2. **禁止把 Windows / ANGLE 兜底写进 Mac 默认路径。**
   开关必须由 `isWindowsPlatform()` 或 `:root[data-platform="windows"]` 显式打开。Mac 的 frost、reduced-motion 静态帧、chase 预编译不得被 Win 现场改掉。
3. **禁止一条 mega-shader 靠 uniform 分支切「完全不同的场」。**
   ANGLE 可以编过但永远走第一档。结构化动势（太极 / 暴风雨 / 龙卷风 / 游走）必须各自一份 display program，切芯片只 `useProgram`。
4. **禁止在第一帧 present 之后才编译关键 program，还假设一定成功。**
   要在 RAF 启动前编好本档。过大的 program（如 chase 龙场）在 Win 上延后到点选；编不过必须降级变体或 CSS，**禁止静默画成流动**。
5. **禁止 `backdrop-filter` 直接盖 WebGL canvas 而不做 Windows 验收。**
   WebView2 上这就是黑底。Win 用洗色、不要 blur；Mac 可保留毛玻璃。
6. **禁止在 canvas 未 `attached` 时打透明孔。**
   `data-workspace-wallpaper` 一类 punch-through 会让实色主题底消失。Win 必须等 shader attach；失败保持实色 chrome。
7. **禁止 RAF 停了还不重画。**
   `setParams` / 切 chip / 换配色必须立刻 `draw` 一帧，并在应该动的时候 `startLoop`。reduced-motion 可以只画静帧，但换场必须换静帧。
8. **禁止把系统 `prefers-reduced-motion` 当成「用户不想要这张壁纸」。**
   用户在设置里点了流体 = 选择动。Windows WebView2 会误报 reduce。工作台 Win 路径可 `forceAnimate`；Mac / first-run 继续尊重系统 reduce。
9. **禁止用 Chrome / Edge 标签页或 HTML 原型代替 WebView2 验收。**
   设计稿能切五档，只证明 GLSL 语义，不证明 ANGLE 编译与合成。
10. **禁止为了测 dev 去 kill 正在跑会话的客户端。**
    用 `tauri:dev:isolated`（`ccgui-dev` / 端口 1430）。`ensure-dev-port` 默认 1420 会误杀当前窗。

## 必须项（Required）

1. **平台分离表**写进 design / 代码注释，至少覆盖：frost、预编译集合、打孔时机、reduced-motion。
2. **WebGL2 context** 按 flags 降级重试（`desynchronized` 可扔；`alpha` / `premultipliedAlpha` / `powerPreference` 换组）。拿不到 context = CSS fallback，不要抛穿向导或设置页。
3. **GLSL 偏保守**：ANGLE/D3D 对小 `int` loop 过敏时改 float induction；模板字符串里的 GLSL 注释禁止再套反引号（会截断 TS template）。
4. **opaque canvas**（`alpha: false`）在首帧前是黑的。启动期编译必须短，或先不打孔。
5. **验收**：Windows 真机开发者客户端手测 流动 / 太极 / 暴风雨 / 龙卷风 / 游走 + 不要背景 + 自定义；Mac 回归 frost 与 reduced-motion。没机器写「未测」。

## 改这些文件前先重读本文

- `src/features/onboarding/utils/fluidShader.ts`
- `src/features/onboarding/components/FirstRunFluidBackdrop.tsx`
- `src/features/theme/components/WorkspaceWallpaperHost.tsx`
- `src/styles/workspace-wallpaper.css`
- 任何新增 WebGL / canvas 全屏动效、`backdrop-filter` 盖动态层、或按平台开关视觉效果的代码

## 相关事实源

| 内容 | 路径 |
|------|------|
| 本 change | `openspec/changes/enable-windows-workspace-wallpaper/` |
| 对照原型 | `docs/designs/fluid-motion-presets/index.html` |
| Native zoom / 毛玻璃门禁 | `native-webview-api-risk-gate.md` |
| 冷启动点击假死（同属 WebView2，不是动效） | `windows-cold-start-click-freeze-pitfall.md` |
