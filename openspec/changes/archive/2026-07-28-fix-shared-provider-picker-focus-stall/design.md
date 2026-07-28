## Context

Shared picker 的 Provider Profiles 位于 Radix `DropdownMenuSubContent`。上一版引入
`openProviderGroupId + pinnedProviderGroupIdRef`，以外部 controlled state 强制 submenu
保持打开。该状态与 Radix 自己的 pointer grace、focus scope、dismiss state 同时写同一
open decision，连续交互时可能形成重复更新/焦点争夺。

## Goals / Non-Goals

**Goals:**

- 恢复 Radix 为 submenu open state 的唯一 owner。
- Shared pointer 移入 Profile row 时不触发 focus transfer dismiss。
- Accordion 只保留一个 React state：`expandedProviderProfileKey`。

**Non-Goals:**

- 不改 Native picker。
- 不改 target/catalog/continuation 数据流。
- 不引入 timer、global listener 或自绘 floating panel。

## Decisions

### 1. 删除 controlled/pinned submenu state

移除 `openProviderGroupId`、`pinnedProviderGroupIdRef`、`pinSharedProviderSubmenu` 以及
`DropdownMenuSub.open/onOpenChange`。CLI submenu 回到 Radix uncontrolled lifecycle。

### 2. Shared submenu 忽略父 root content 的焦点回弹

完整 pointer sequence 证明，submenu 关闭由 `onFocusOutside` 触发，event target 是父
`DropdownMenuContent`，并非真正 outside surface。Shared `DropdownMenuSubContent` 只在
target 精确为 `data-slot="dropdown-menu-content"` 时 `preventDefault()`；聚焦其他 CLI
item、Escape 与真正 outside focus 不被拦截。click/keyboard selection 仍由 `onSelect`
完成并同步 `preventDefault()`，因此 accordion action 不成为 terminal menu selection。

Native path 不使用 nested submenu，保持当前已验证行为。

### 3. 测试连续交互而非只测一次点击

测试执行 A/B/A/B 和同 Profile 重复折叠/展开，并限制每个操作在正常 async interaction
内收敛。最终选择 Model，断言 callback 一次且菜单关闭。

## Risks / Trade-offs

- [Risk] root content selector 过宽会吞掉真正的 CLI 切换 → 只匹配 event target 本身的
  `data-slot`，不对 root content descendants 使用 `closest()`。
- [Risk] pointer grace 在真实 WebView 与 jsdom 有差异 → 测试使用 `userEvent` 完整
  pointer sequence，并保留 Native/Shared 既有 suites。

## Migration Plan

无数据迁移。回滚为恢复上一版 controlled submenu diff，但不建议。

## Open Questions

无。
