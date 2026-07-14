## Context

`ThreadRowItem` 和 `PinnedThreadRowItem` 为每一行常驻创建 Popover 与 Tooltip，并把同一 button 同时放进 `PopoverAnchor asChild` 和 `TooltipTrigger`。首次安装启动会批量 hydrate persisted rows；新 bundle stack 同时出现 TooltipProvider、PopoverProvider、ScrollAreaProvider，与源码结构一致。

## Goals / Non-Goals

**Goals:** 移除正常态 thread row 的 Radix anchor/provider fan-out，复用 Floating tooltip 保持外观，并让 delete Popover 按需存在。

**Non-Goals:** 重写 ScrollArea、session state 或全局 Radix primitives。

## Decisions

### Decision 1: 提取 FloatingTooltipButton

从 TooltipIconButton 抽取 forwardRef native button primitive，统一 hover/focus delay、portal、placement、collision、ARIA 与 visual class。关闭态只维护 native button DOM ref；`useFloating` 与 `autoUpdate` 仅在 tooltip 实际打开后挂载，避免冷启动按 row 数量创建 positioning state。TooltipIconButton 保持原 props，通过共享 primitive 薄封装。

### Decision 2: ThreadRow normal path 不挂载 Popover

Thread row 始终保持同一个 FloatingTooltipButton trigger。仅 `isDeleteConfirmOpen` 时挂载 controlled Popover，并用 button ref 作为 `PopoverAnchor.virtualRef`；不再通过 `asChild` clone trigger 或切换 trigger 父结构。这样 cold-start/hydration 无 Popover provider/anchor，删除确认打开/关闭也不改变 button identity 与 focus。

## Risks / Trade-offs

- [Risk] controlled Popover dismiss 重复触发 cancel → Mitigation：Escape/outside dismiss 在 Content 边界显式处理并 prevent default；测试单次回调。
- [Risk] tooltip behavior drift → Mitigation：共享现有 Floating primitive，不复制 positioning logic。
- [Risk] test 未复现 production fan-out → Mitigation：StrictMode + ScrollArea + 多 rows + console #185 guard。

## Migration Plan

迁移普通/置顶两种 row，运行 focused、AppShell startup、typecheck/lint、production build 与新包首次启动验收。未通过 production acceptance 不宣称解决。
