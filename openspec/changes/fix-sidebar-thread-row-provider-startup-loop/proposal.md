## Why

新 production bundle 首次安装启动仍触发 React #185。bundle 行列反查显示回环来自 Sidebar `ScrollArea → ThreadRow → Popover → Tooltip → PopoverAnchor → TooltipTrigger`，而非已迁移的 TooltipIconButton；批量 persisted thread rows hydrate 时会同时注册大量 Radix anchors/providers。

## 目标与边界

- 普通与置顶 ThreadRow 在冷启动正常态不挂载 Radix Tooltip、Popover Provider 或 Anchor。
- 保留会话名 tooltip 的现有视觉、定位、延迟和 a11y。
- 删除确认 Popover 仅在确认态按需挂载，行为保持不变。

## What Changes

- 抽取 native button + Floating UI portal 的共享 `FloatingTooltipButton`。
- `TooltipIconButton` 复用共享 primitive。
- `ThreadList`、`PinnedThreadList` 会话行迁移到 Floating tooltip。
- Popover/PopoverAnchor 从常驻改为 `isDeleteConfirmOpen` 时挂载。
- 增加多 row + StrictMode + ScrollArea hydration regression。

## 方案比较与取舍

- 方案 A：延迟挂载现有 Radix providers。只能缩小 race window，不能消除 provider/anchor feedback loop。
- 方案 B：ThreadRow 正常态退出 Radix Tooltip/Popover，复用 Floating UI 视觉定位；仅交互确认态按需挂载 Popover。该方案移除冷启动反馈环且不回退外观，采用方案 B。

## 非目标

- 不全局替换所有 Radix Tooltip/Popover/ScrollArea。
- 不修改 session hydration、sidebar grouping、pin 或 delete domain state。
- 不改变 thread row DOM 语义和点击/键盘/右键 contract。

## Capabilities

### New Capabilities

- `sidebar-thread-row-provider-startup-stability`: 约束 Sidebar 批量会话行 hydration 时的 provider/anchor 稳定性及 tooltip parity。

### Modified Capabilities

- 无。

## Impact

- `src/components/ui/floating-tooltip-button.tsx`、`tooltip-icon-button.tsx`。
- `src/features/app/components/ThreadList.tsx`、`PinnedThreadList.tsx` 及 tests。
- Backend/storage 无影响。

## 验收标准

- production-style 多 thread rows 在 StrictMode/ScrollArea 中 mount 不出现 maximum update depth。
- 正常态 ThreadRow DOM 不包含 Radix Tooltip/Popover provider/anchor。
- tooltip 外观/side/align/offset/portal/ARIA 保持。
- 删除确认仍能打开、取消、确认。
