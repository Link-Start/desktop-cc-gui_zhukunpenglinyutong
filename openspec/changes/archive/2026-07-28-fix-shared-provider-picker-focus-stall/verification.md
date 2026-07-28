## 验证报告：fix-shared-provider-picker-focus-stall

### 摘要

| 维度 | 状态 |
|---|---|
| 完整性 | 5/5 tasks；1 modified requirement |
| 正确性 | 5/5 scenarios 有实现与回归证据 |
| 一致性 | Radix 恢复为 submenu open state 的唯一 owner |

### Root Cause Evidence

- 修复前完整 `userEvent` pointer sequence 触发 submenu `onFocusOutside`。
- `event.target` 是父 `data-slot="dropdown-menu-content"`，不是实际 outside surface。
- 上一版 controlled/pinned submenu state 与 Radix open/focus lifecycle 竞争，存在 stall 风险。

### Implementation Evidence

- 删除 `openProviderGroupId`、`pinnedProviderGroupIdRef`、
  `pinSharedProviderSubmenu` 与 controlled `DropdownMenuSub`。
- Shared `DropdownMenuSubContent.onFocusOutside` 只忽略 target 精确为父 root content 的
  focus bounce；不使用 `closest()`，不吞其他 CLI item 或真正 outside focus。
- Provider accordion 统一由 cancelable `onSelect` 更新
  `expandedProviderProfileKey`。
- 回归测试覆盖 B → A → B → B → B → Model selection 的连续交互。

### Gate Evidence

- Vitest：8 suites，130 tests passed。
- `npm run typecheck`：passed。
- `npm run lint`：0 errors；8 个既存、非本次文件 warnings。
- `npm run check:runtime-contracts`：passed。
- `git diff --check`：passed。
- Focused OpenSpec strict validation：passed。

### 问题

- CRITICAL：无。
- WARNING：无。
- SUGGESTION：无。

### 最终评估

所有检查通过，满足同步与归档条件。
