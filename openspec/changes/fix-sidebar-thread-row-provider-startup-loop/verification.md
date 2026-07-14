## 验证报告：fix-sidebar-thread-row-provider-startup-loop

### 摘要

| 维度 | 状态 |
|---|---|
| 完整性 | 7/7 tasks；production first-install acceptance passed |
| 正确性 | 3/3 scenarios 有实现与 automated evidence；新包首次启动人工验收通过 |
| 一致性 | normal ThreadRow 无 Radix Tooltip/Popover provider/anchor；delete Popover 按需挂载 |

### 根因证据

- 新 bundle `App-BDZCgSH1.js` stack 同时出现 TooltipProvider、PopoverProvider、ScrollAreaProvider。
- bundle 行列反查映射到 `ThreadList` / `PinnedThreadList` row composition。
- 原实现为每行常驻 `Popover → Tooltip → PopoverAnchor asChild → TooltipTrigger`，首次 hydrate 形成 provider/anchor fan-out。
- React/ReactDOM/Radix versions 在修复前后未漂移，排除 dependency upgrade 归因。

### 实现证据

- `FloatingTooltipButton`: 关闭态只有 native button/ref；打开后才挂载 Floating UI portal，保持 visual/placement/delay/a11y，并支持 Escape dismiss。
- `TooltipIconButton`: 薄封装共享 primitive。
- normal/pinned ThreadRow: 正常态无 Radix row provider/anchor；delete confirm open 时才挂载 Popover。
- `ThreadDeleteConfirmPopover`: 普通/置顶共享 virtual anchor；Popover 开关不 clone/remount trigger，保持 DOM identity 与 focus。

### 自动验证

- TooltipIconButton + ThreadList + PinnedThreadList + AppShell startup: 4 files / 52 tests passed。
- StrictMode + ScrollArea + 8 normal rows / 6 pinned rows：无 #185/maximum-depth，DOM 无 tooltip-trigger/popover-anchor。
- existing click/context/pin/delete confirmation regression passed；新增 Escape dismiss、trigger identity/focus 与 cancel 单次回调覆盖。
- `npm run build`: production bundle passed；仅保留仓库既有 chunk-size/dynamic-import warnings。
- `npm run typecheck`: passed。
- `npm run lint`: passed。
- `npm run check:large-files`: touched ThreadList 798 lines，低于 800-line ratchet；仅剩未触碰 `useThreads.ts` baseline item。
- strict OpenSpec validation and `git diff --check`: passed。

### 人工验收

- 用户重新打包并执行新安装包首次启动，客户端未再进入 ErrorBoundary，未出现 React #185。
- production first-install acceptance 已通过，task 3.2 完成。
