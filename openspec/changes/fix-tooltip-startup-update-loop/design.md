## Context

`TooltipIconButton` 曾向 compatibility wrapper 传入 `render={<button />}`，wrapper 再通过 Radix `asChild` 进入 `SlotClone`。仅改成显式 child button 后，真实 WebView 仍复现同一 `SlotClone / TooltipTrigger / TooltipIconButton / SidebarCollapseButton` 回环，证明风险来自 Slot composition 本身。修复必须让该链路不再生成 Slot。

## Goals / Non-Goals

**Goals:** 使用 native button + Floating UI portal，彻底移除该链路的 Radix `PopperAnchor / SlotClone`，保持现有 tooltip visual/placement contract，并以真实 sidebar fixture 覆盖启动稳定性。

**Non-Goals:** 删除 compatibility API、调整 Tooltip portal/style 或修改 sidebar state orchestration。

## Decisions

### Decision 1: TooltipIconButton 退出 Radix Tooltip orchestration

`TooltipIconButton` 直接渲染 native button，并用 `@floating-ui/react-dom` 的 `useFloating + autoUpdate + offset + flip + shift` 定位 body portal。popup 复用 `TOOLTIP_POPUP_CLASS_NAME`，保留 side/align/offset/custom class、delay、collision avoidance 与 a11y。普通文本 Tooltip 继续使用 Radix，不扩大修改面。

仅让 Radix Trigger 直接生成 button 仍会经过 Tooltip 内部固定的 `PopperAnchor asChild`，真实 WebView 已再次复现 `Primitive.div.SlotClone`，因此 direct Radix trigger 不是根治方案。

### Decision 2: regression test 使用真实 SidebarCollapseButton + StrictMode

测试通过真实组件构建 sidebar/topbar host 变化，循环 hover-open、rerender、unmount/remount，并监听 `console.error`。相比 synthetic `TooltipIconButton` fixture，它能覆盖截图 stack 中的 caller 与 React lifecycle。

## Risks / Trade-offs

- [Risk] popup visual drift → Mitigation：Radix Tooltip 和 Floating tooltip 共用同一 visual class constant，并测试 theme class/custom class/portal/placement。
- [Risk] viewport overflow → Mitigation：使用 `flip + shift({ padding: 8 })` 与 `autoUpdate`，不手写 positioning algorithm。
- [Risk] jsdom 无法完全复现 Tauri WebView timing → Mitigation：保留 AppShell startup suite，并要求 desktop manual smoke test。

## Migration Plan

直接替换 shared component 内部 DOM composition，无数据迁移。回滚只需恢复旧 trigger branch。
