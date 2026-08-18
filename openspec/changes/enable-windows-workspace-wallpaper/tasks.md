## 1. 去掉 Windows 平台门禁

- [x] 1.1 删除 `isWorkspaceFluidWallpaperSupported`；`resolveWorkspaceWallpaperMode` 三端同语义
- [x] 1.2 Settings 外观无条件展示页面背景 / 流体 / 自定义
- [x] 1.3 `FirstRunFluidBackdrop` 去掉 `solidOnly`，Windows 挂 canvas
- [x] 1.4 custom 图失败回退 `fluid`，不再因 Windows 改 `none`

## 2. WebView2 兼容

- [x] 2.1 `attachFluidShader` 对 context flags 降级重试
- [x] 2.2 compile / link 失败写诊断，返回既有 no-op
- [x] 2.4 按动势拆 display program；chase 编不过走降级变体，禁止静默回流动
- [x] 2.3 Windows 真机：设置里开流体，五档可切且在动；Mac 不走 forceAnimate / 延后 chase / 去 blur / 延后打孔

## 3. 规格与测试

- [x] 3.1 `workspace-wallpaper` delta：Windows MUST 展示入口并渲染 fluid
- [x] 3.2 反转 Settings / host / first-run / sanitize 的 Windows hide 断言
- [x] 3.3 focused vitest 绿（wallpaper / host / first-run / shader / SettingsView 81）
- [ ] 3.4 Windows 手测：流体 / 自定义 / 不要背景 / 重启保持；向导不再实色短路
