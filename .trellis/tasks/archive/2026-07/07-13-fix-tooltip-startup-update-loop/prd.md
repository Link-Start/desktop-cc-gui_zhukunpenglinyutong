# Tooltip 启动更新回环修复

## Goal

关联 OpenSpec change `fix-tooltip-startup-update-loop`，消除 SidebarCollapseButton 在真实启动 composition 下的 maximum update depth 风险。

## Requirements

- TooltipIconButton 使用标准 Radix `asChild` native button composition。
- 保持 button props、events、a11y 与 tooltip close behavior。
- 真实 SidebarCollapseButton + StrictMode fixture 覆盖回归。

## Acceptance Criteria

- [ ] 单一 native button，无 nested button。
- [ ] layout host rerender/remount 不出现 maximum update depth。
- [ ] focused tests、typecheck、lint 与 strict OpenSpec validation 通过。

## Technical Notes

不删除 shared TooltipTrigger 的 legacy `render` compatibility，只让 TooltipIconButton 不再使用该路径。
