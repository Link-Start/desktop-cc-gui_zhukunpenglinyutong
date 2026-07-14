# Sidebar 会话行 Provider 启动回环修复

## Goal

关联 OpenSpec `fix-sidebar-thread-row-provider-startup-loop`，消除新包首次启动时批量 ThreadRow hydration 引发的 React #185。

## Requirements

- 普通/置顶 ThreadRow 正常态退出 Radix Tooltip/Popover providers。
- 复用 Floating tooltip，保持视觉、定位、延迟和 a11y。
- 删除确认 Popover 仅按需挂载。

## Acceptance Criteria

- [x] StrictMode + ScrollArea + 多 rows 不出现 maximum update depth。
- [x] 正常态无 tooltip trigger / popover anchor DOM。
- [x] 点击、右键、pin、delete confirmation tests 通过。
- [x] typecheck、lint、strict OpenSpec validation 通过。
- [x] 新 production bundle 首次安装由用户验收后才关闭 change。
