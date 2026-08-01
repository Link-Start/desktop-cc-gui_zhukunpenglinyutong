## Context

当前 bundle 已包含 Quick Switcher projection 的 updater equality guard，但 hook 仍把 `workspaces -> recent-file groups` 这份 derived projection 存成 React state，并在依赖 `workspaces` 的 effect 中主动刷新。production AppShell 的 workspace projection 在 cold-start hydration 期间允许出现语义等价的新引用；让 derived state effect 订阅该引用，仍会把 sibling projection 接回 AppShell render graph。

本次不继续追加外围 guard，而是删除错误的 state ownership：React state 只保存可由 storage event 改变的 normalized recent-file snapshot；workspace projection 在 render 中纯派生。

## Goals / Non-Goals

**Goals:**

- `workspaces` 等价换引用不得触发任何 Quick Switcher state setter。
- storage event 或首次 effect attach 前发生的 storage mutation 仍能刷新 recent files。
- workspace rename 和真实 recent-file mutation 继续更新 projection。
- 保持 projection referential stability，避免无意义下游 rerender。

**Non-Goals:**

- 不重构 AppShell workspace controller 或 Quick Switcher UI。
- 不修改 recent-file storage schema、limit 或排序。
- 不引入 deep-equality dependency。

## Decisions

### Decision 1: state 保存 source snapshot，不保存 workspace-derived projection

hook 初始化时读取 normalized `RecentFilesByWorkspace`；mount effect 订阅 storage event，并在订阅后主动 refresh 一次，以覆盖 sibling effect 在 listener attach 前完成的写入。返回值由 `projectQuickSwitcherRecentFileGroups` 纯派生。

备选：保留 groups state 并增加更多 last-run ref。拒绝，因为 derived state ownership 本身制造了 feedback edge。

### Decision 2: 对 workspace catalog 做有界 semantic stabilization

仅比较 projection 实际消费的 `id/name` 和顺序；语义未变时复用上一 workspace catalog reference，真实 rename/add/remove 时换成新引用。recent-file snapshot 继续用有界 JSON equality（受 recent limit 限制）。

备选：要求所有 AppShell 调用方 memoize `workspaces`。拒绝，因为遗漏任一调用方即可恢复 feedback，且 ownership 不在调用方。

### Decision 3: regression 直接断言 setter ownership

focused hook test 模拟等价 workspace rerender、listener attach 前 mutation、真实 storage event 与 rename。测试不仅检查最终 UI 值，还断言 storage snapshot state 的发布次数有界。

## Risks / Trade-offs

- [Risk] mount refresh 与 event 同时到达。→ updater 对 normalized snapshot 做 equality gate，重复读取返回原引用。
- [Risk] workspace comparator 漏字段。→ projection 当前只消费 `id/name`，类型也收窄到这两个字段；测试覆盖 rename。
- [Trade-off] 每次 render 做一次小型 workspace catalog O(n) 比较。→ workspace 数量远小于文件数量，且换来彻底移除 effect feedback。

## Migration Plan

1. 补齐 hook regression。
2. 将 hook state 改为 normalized source snapshot，并把 projection 改为 `useMemo`。
3. 跑 focused Vitest、受影响文件 lint/typecheck、production build 和 OpenSpec strict validation。

Rollback：回退 hook、helper、tests 和本 change artifacts；无数据迁移。

## Open Questions

- 若修复后的新安装包仍出现 `#185`，必须用新增 updater attribution 建立新的独立 change，不再扩张本 hotfix。
