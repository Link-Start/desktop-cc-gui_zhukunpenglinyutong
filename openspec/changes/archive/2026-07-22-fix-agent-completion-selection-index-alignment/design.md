## Context

`useCompletionDropdown` 同时维护 presentation `items` 与 provider `rawItems`。`CompletionDropdown` 的 `activeIndex` 明确定义为过滤 `separator` / `section-header` 后的 selectable index；但 hook 当前把全部 mapped result 放入 `rawItems`，再用 selectable index 直接访问它。智能体目录引入 section header 后，两套序列失去对齐。

约束：修复必须覆盖 mouse 与 keyboard，不改变 provider、DOM 结构、agent persistence、send payload，也不能为单个 picker 引入特殊分支。

## Goals / Non-Goals

**Goals:**

- 建立 `activeIndex/selectIndex` 与 selectable raw provider items 的一一映射。
- 保持 presentation-only items 可见且不可选。
- 用最小 focused tests 锁定 mouse-index 与 keyboard-active 两条路径。

**Non-Goals:**

- 不重构通用 dropdown component。
- 不改变 info item 的既有可选择语义。
- 不修改 agent catalog loading、grouping 或 send-time resolution。

## Decisions

### Decision 1: mapping 阶段分离 presentation sequence 与 selection sequence

`toDropdownItem(result)` 成功后始终加入 `items`；只有类型不是 `separator` / `section-header` 时，才把原始 `result` 加入内部 `rawItems`。因此 `rawItems[index]` 与 `selectableItems[index]` 永久对齐。

Alternatives：

- Agent picker 局部减 header offset：无法保护 keyboard path 与其他 completion provider，拒绝。
- Selection 时扫描 `items` 换算 full raw index：可以工作，但重复运行映射且保留两套易误用的 index contract，拒绝。

### Decision 2: 同时验证 direct index 与 active selection

`selectIndex` 代表 mouse path；`selectActive` 代表 Enter/Tab 最终调用路径。测试使用一个 header 加两个普通项，分别断言第二项与第一项的 raw identity，直接覆盖截图所示回归。

## Risks / Trade-offs

- [Risk] 未来增加新的 presentation-only type 时 predicate 可能漂移 → 现阶段严格复用现有 dropdown predicate；新增类型必须同时更新 shared hook test。
- [Risk] 改变 `rawItems` 内部语义 → 它未从 hook 暴露，唯一消费者是 `selectIndex/selectActive`，影响封闭。
- [Trade-off] `info` item 仍在 selectable sequence → 保持当前行为，避免扩大修复范围。

## Migration Plan

1. 更新 hook mapping。
2. 添加 focused regression tests。
3. 运行 focused Vitest、typecheck、lint 与 strict OpenSpec validation。
4. 回滚时仅还原 hook/test diff；无数据迁移与持久化变化。

## Open Questions

无。
