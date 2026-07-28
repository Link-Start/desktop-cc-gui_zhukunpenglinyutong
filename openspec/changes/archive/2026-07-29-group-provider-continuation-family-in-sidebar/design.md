## Context

`ThreadSummary` 已包含 `familyId`、`familyRootSessionId`、`lineageParentSessionId`、`lineageKind` 与 `lineageDepth`。当前 `ThreadList` 只使用 `parentThreadId` 构建 Subagent Tree；Provider Continuation 作为普通顶层 row 渲染 Origin badge，因此同一 Family 的 rows 会被更新时间排序拆散。

`ThreadList` 同时支持 pinned / unpinned、hide-exited、Subagent collapse、folder/worktree scope，以及基于 `@tanstack/react-virtual` 的 virtualized rendering。设计必须在不引入 backend/storage 变化、不破坏虚拟列表高度测量、不混淆 Subagent ownership 的前提下增加视觉聚合。

## Goals / Non-Goals

**Goals:**

- 用 authoritative Conversation Family metadata 将相关顶层 Session 投影为连续 presentation block。
- 用轻围挡和 label 表达“同一续接链”，保持所有 row 的独立身份与交互。
- Virtualized / non-virtualized、pinned / unpinned、folder / worktree scope 行为一致。
- 缺失或未知 lineage metadata 时 fail open，不产生猜测式分组。

**Non-Goals:**

- 不创建 Parent-Child Tree、折叠状态、Family navigation model 或 durable ordering。
- 不改变 session catalog、Provider Continuation runtime、Subagent projection 或 folder assignment。
- 不跨 pinned boundary、workspace、worktree、folder 或当前加载窗口聚合。

## Decisions

### Decision 1：使用独立的纯 presentation projection

新增一个纯函数，将已完成 visibility filter 与 Subagent collapse 的 `ThreadRow[]` 投影为带 Family segment metadata 的 rows。它只读取：

- `familyId`
- `familyRootSessionId`
- `sourceSessionId`
- `lineageParentSessionId`
- `lineageKind`
- `lineageDepth`
- `originKind`
- 现有 row 顺序与 depth

输出包含 `familyPosition = start | middle | end`、可见 member count 与 accessible label；不写回 `ThreadSummary`。

替代方案是在 `ThreadList` render callback 中临时扫描前后元素。拒绝：virtual / non-virtual 两条 render path 容易漂移，也无法先把分散 members 排成连续 block。

### Decision 2：以 root subtree 为最小移动单元

先将 flat rows 切为 root blocks：一个 depth=0 row 加其已有 Subagent descendants。Conversation Family 只给 root block 分组；移动 Family member 时携带完整 Subagent subtree，禁止拆散现有 Parent-Child Tree。

Family block 位置使用其第一个可见 member 在当前列表中的位置；Family members 与所有非 Family blocks 分别保持原有相对顺序。这等价于在现有 newest-first 列表中，把同一 Family 后续 members 拉到该 Family 最新可见 member 后面。

替代方案按 `lineageDepth` 重新排序。拒绝：它会把 Sidebar 变成隐式 lineage tree，并改变用户熟悉的时间顺序。

### Decision 3：严格限定可分组 Family

只有同时满足以下条件才绘制围挡：

1. 当前 pinned 或 unpinned partition 内至少一个 Provider Continuation 具有非空 `familyId`，且同一 partition 内至少还能解析出一个直接 Family member 或权威来源 Session；
2. 至少一个 member 明确为 `originKind = provider-continuation` 或 `lineageKind = provider-continuation`；
3. 没有 member 携带当前 UI 不认识的非空 `lineageKind`。

Legacy 来源 Session 可能没有自身 `familyId`。Projection MUST 仅使用 continuation 已持久化的
`sourceSessionId`、`lineageParentSessionId` 或可精确匹配当前 row canonical id 的
`familyRootSessionId`，把来源 root block 纳入同一 Family。不得做 prefix、title、timestamp、
Provider、内容或相邻位置猜测；同一来源被多个不同 Family claim 时 fail open，不归入任一围挡。

### Decision 4：轻围挡由 row segments 拼接，不引入可折叠容器

每个 Family root block 外层增加 presentation wrapper。首段渲染 label，首尾段绘制圆角，中间段只延续左右细边框与低对比 surface；Subagent descendants 保持在其 root segment 内。Label 文案为 `续接会话 · {{count}} 个`，count 只统计当前 partition 中可见 Family root members。

Wrapper 不使用 tree role、`aria-expanded`、indent 或 expander。Label 提供可读 accessible text，但不成为新的点击目标。Row 自身继续拥有 focus、selection、Context Menu 与 tooltip。

替代方案为单个 DOM container 包裹全部 Family members。拒绝：virtualized list 以每个 row 为测量和定位单元，跨 virtual item container 会破坏绝对定位与 overscan。

### Decision 5：先分区再分组

Pinned 与 unpinned 独立投影；workspace、worktree 与 folder 已由各自 `ThreadList` scope 隔离。Family 不能跨 separator 或分页未加载边界形成一个 DOM 围挡。Hide-exited 后 count 反映实际可见 members；恢复显示时纯投影自动重建。

## Data Flow

```text
catalog ThreadSummary[]
  -> pinned/unpinned + folder/worktree scope
  -> exited visibility filter
  -> Subagent collapse filter
  -> split root subtrees
  -> authoritative family grouping + stable block reorder
  -> segment metadata
  -> virtual/non-virtual shared row renderer
  -> lightweight CSS boundary + i18n label
```

## Risks / Trade-offs

- [Risk] Family grouping改变纯时间排序。→ 以最新可见 member 的原位置作为 block anchor，组内保持既有顺序，并用 label 解释聚合原因。
- [Risk] Virtualized row 的 label 让首段高度变化。→ 继续使用 `measureElement` 实测高度；估算值只作为初始值，并增加 virtualization regression。
- [Risk] Subagent descendants 被误认为 Family members。→ count 仅统计 depth=0 Family roots；Subagent subtree 只随所属 root 原子移动，保留原 class/indent。
- [Risk] Pinned source 与 unpinned continuation 无法形成同一围挡。→ 明确 partition boundary 优先，避免跨 separator 重排；两侧仍保留 Origin badge。
- [Risk] Legacy 来源没有自身 `familyId`。→ 只按 continuation 的 exact authoritative source/lineage reference 解析当前 partition 中的 canonical row；多 Family 冲突时不吸附来源。
- [Risk] 低对比边框在不同 theme 下不可见。→ 使用现有 semantic border/surface tokens 与 `color-mix`，覆盖 light/dark 和 active/focus screenshot/manual check。

## Migration Plan

1. 纯 frontend additive rollout，无数据迁移。
2. 增加 projection helper 与 focused unit tests。
3. 接入 `ThreadList` 两条 render path并增加 DOM regression。
4. 增加 i18n 与 Sidebar CSS。
5. 运行 focused Vitest、typecheck、strict OpenSpec validation 和窄 Sidebar 人工检查。

回滚只需移除 presentation projection、wrapper styles 与 i18n label；Family metadata 与现有 Session 行为不受影响。

## Open Questions

无。用户已选择 Option A“轻围挡”；首版 label 固定为“续接会话 · N 个”，不增加折叠或自定义命名。
