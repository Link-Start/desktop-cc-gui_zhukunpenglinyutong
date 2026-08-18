## 背景

`448cd3e99`（`skip Windows fluid`）认定「Windows does not support the fluid wallpaper shader safely」，于是：

1. `isWorkspaceFluidWallpaperSupported(win) === false`
2. `resolveWorkspaceWallpaperMode(..., true)` 一律 `none`（连自定义图也关掉）
3. Settings 隐藏整段页面背景
4. `FirstRunFluidBackdrop` `solidOnly` 不挂 canvas

这是平台级封死，不是运行时探测。WebGL2 失败路径其实早就有：`attachFluidShader` 拿不到 context / compile 失败返回 no-op，CSS 渐变兜底。

用户现在要解禁并现场修兼容性。

## 方案

**选定：去掉平台门禁 + WebView2 context 降级，失败仍走 CSS fallback**

| Option | Summary | Trade-off |
|--------|---------|-----------|
| A. 解禁 + 运行时降级（采用） | 三端同一入口；context flag 过敏则重试；compile 失败 no-op | 若 shader 导致 GPU 假死，需后续看门狗 |
| B. 只解禁设置、仍禁 shader | 用户能看到入口但点流体无画 | 验收上等于没修好 |
| C. Windows 另写 CSS 流体 | 避开 WebGL | 视觉分叉，动势五场做不到 |

### 门禁删除

- 删除 `isWorkspaceFluidWallpaperSupported`。
- `resolveWorkspaceWallpaperMode` 不再吃 `isWindows`：`custom` 且无路径 → `fluid`；其余原样。
- Settings 外观无条件渲染页面背景行。
- `FirstRunFluidBackdrop` 删除 `isWindowsPlatform` / `data-solid`。

### WebView2 context

`getContext("webgl2", { desynchronized: true, premultipliedAlpha: false, alpha: true })` 在部分 WebView2 / ANGLE 上会抛、返回 `null`，或给出不能正确合成的 context。流体没有接鼠标 stir，`desynchronized` 无收益。对照能跑的 `docs/designs/fluid-motion-presets/index.html`，按序试：

1. 原型同款：`alpha: false` + `low-power`（无 desynchronized）
2. `alpha: true` + `premultipliedAlpha: true`
3. `alpha: true` + `premultipliedAlpha: false` + default power
4. 无 attribute 的 `webgl2`

任一次成功即用。compile / link 失败 `console.warn` 带 info log，返回 no-op。

### 按动势拆 display program（现场：后四档看起来像没适配）

一条 mega-shader + `if (u_motionMode > 0.5) { ... return; }` 在 WebView2 / ANGLE 上会表现为：流动（drift 两通道路径）正常，太极 / 暴风雨 / 龙卷风 / 游走切过去仍停在流动，或整份 fragment 因龙场指令数编不过。

反转 `add-fluid-motion-presets` D2「不 relink」：

- drift 继续走既有 two-pass
- taiji / storm / tornado / chase 各编一份 display program，切芯片时 `setParams` 换 program
- 结构化场不再走 early return，也不再和 drift 挤同一份源
- chase 全量编不过时降到 14 段脊骨 / 两腿，lite 下加粗 `u_strokeScale`，避免半分辨率 + 毛玻璃把细线吃掉
- 某一档失败 MUST NOT 静默画成流动

### 锁死循环

流体默认仍是 `none`，不在启动必经路上。first-run 现在会挂 shader，但 attach 失败是同步 no-op，不挡向导。若现场证实 RAF / ANGLE 会假死，再按 `uiScaleStartupGuard` 补 pending 记录；本轮不预先加 timeout 当修复。

### 不改

- 动势 / 配色 / 毛玻璃语义
- AppShell bag
- native 窗口透明度
- lite / reduced-motion 静态帧契约

### Mac / Windows 分离

Mac 保持解禁前就能用的路径，Windows 兜底不得回写到 Mac：

| 行为 | Mac | Windows / WebView2 |
|------|-----|-------------------|
| 毛玻璃 `backdrop-filter` | 保留 | 关掉（发黑） |
| 工作台 `forceAnimate` | 否，继续尊重 reduced-motion | 是（系统 reduce 会误冻循环） |
| chase 预编译 | 挂载时编齐五档 | 延后到点选，避免丢 context |
| 打孔 `data-workspace-wallpaper` | mode=fluid 立刻打 | shader `attached` 后再打 |
| 拆 display program / context 重试 / 切芯片重画 | 共用（视觉等价，不改场语义） | 共用 |

## 接线

```
Settings 外观（三端）
  └─ persist workspaceWallpaper
        └─ WorkspaceWallpaperHost
              └─ FirstRunFluidBackdrop
                    └─ attachFluidShader（WebView2 降级重试）
```

## 风险

- ANGLE 编译超大 `chase` 龙场可能失败：该档回退 CSS，其它 motion 仍应可编译。
- `backdrop-filter` + WebGL 在 WebView2 上可能发黑或闪：现场看到再收 frost，不预先拆掉毛玻璃。
- 若开启流体后整窗假死：立刻补 startup guard，禁止用固定 timeout 当修复。
