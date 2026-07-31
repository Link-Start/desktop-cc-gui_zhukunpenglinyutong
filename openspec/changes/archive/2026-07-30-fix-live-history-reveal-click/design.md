## Context

`MessagesCore` 通过 `useMessagesHistoryWindow()` 管理 `showAllHistoryItems`，并把该状态传给 `buildLiveTailWorkingSet()`。2026-07-07 的 streaming performance 优化移除了 helper 中 `showAllHistoryItems` 的短路条件，使 active live conversation 无论是否被用户显式展开都持续裁到 bounded tail。

这形成了状态与数据窗口的契约断裂：

1. indicator click 将 presentation mode 切为 `realtime-expanded-history-manual`；
2. working set 仍返回 tail items 和非零 `omittedBeforeWorkingSetCount`；
3. indicator 继续渲染，旧消息仍缺失；
4. 用户看到“点击无效”。

现有 main spec 已限定性能策略只适用于 collapsed live history，并要求 show-all 使用完整 derivation。因此本修复属于恢复既有 contract，不引入新架构。

## Goals / Non-Goals

**Goals:**

- 让 active live conversation 的显式 history reveal 真正进入 full-history presentation。
- 保留 collapsed live conversation 的 bounded tail 性能边界。
- 用 helper unit test 与真实 click component test 固化两层契约。

**Non-Goals:**

- 不改变 full-history 渲染成本模型或引入新 snapshot store。
- 不修改 scroll head reset、anchor jump、virtualizer 或 lightweight mode。
- 不改变 idle history、runtime payload 与 persistence。

## Decisions

### Decision 1: 在共享 working-set helper 恢复 `showAllHistoryItems` 短路

`buildLiveTailWorkingSet()` 是所有调用方的统一裁剪边界。将条件恢复为：

```text
if not isThinking OR showAllHistoryItems OR visibleWindow <= 0
  return full items with zero omitted count
otherwise
  return bounded live tail
```

该修复只改共享根因，避免在 indicator、timeline model 或 component render 层做重复补丁。

Alternatives:

- 隐藏/禁用 live indicator：保住性能但移除既有能力，拒绝。
- 点击后等待 turn idle 再展开：状态反馈复杂且不符合即时交互，拒绝。
- 新建 frozen-history lane：长期可研究，但本次 YAGNI。

### Decision 2: 保留显式展开的 full-history 成本

完整 derivation 只发生在用户主动点击后；默认 collapsed streaming 仍受 `STREAMING_VISIBLE_WINDOW` 保护。这与 main spec 的性能边界一致：优化默认路径，不让优化把显式能力变成假按钮。

### Decision 3: 两层测试覆盖

- helper test 验证 `isThinking=true + showAllHistoryItems=true` 返回原始完整数组及零 omitted count。
- component test 使用超过 live working-set 上限的 streaming items，点击 indicator 后验证首条历史消息出现、indicator 消失。

## Risks / Trade-offs

- [用户在超长 live conversation 中展开后 derivation 成本上升] → 保持为显式用户选择；默认 collapsed 路径不变，后续若实测仍过重再设计 frozen snapshot lane。
- [component test 受 virtualizer/scroll timing 影响] → 只断言可观察 DOM 契约，不绑定内部 measurement 数值。
- [误伤 idle 或 jump reveal] → 共享 helper 的既有 idle tests 与 presentation-scope tests继续覆盖。

## Migration Plan

1. 先修改 helper unit contract，确认修复前失败。
2. 恢复 helper 条件并补 component click regression。
3. 运行 targeted Vitest、typecheck 与 OpenSpec strict validation。
4. 回滚时删除新增测试并恢复 helper 条件；无数据迁移。

## Open Questions

None.
