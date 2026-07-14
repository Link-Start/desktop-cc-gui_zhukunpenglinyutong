## Context

`useUnifiedSearch` 当前输出按 score 排序的扁平 `SearchResult[]`，`SearchPalette` 直接逐项渲染，并由 app-shell 维护 `selectedIndex`。文件 provider 同时把完整 path 写入 `title`、`filePath` 和 `locationLabel`，导致 primary label 与 metadata 重复。变更必须兼容 macOS/Linux `/` 与 Windows `\` path，并保护现有 search performance 与 keyboard contract。

## Goals / Non-Goals

**Goals:**

- 在 UI presentation boundary 为结果增加稳定、可扫描的 kind sections。
- 文件 primary title 使用 basename，完整 path 保持可见且可用于打开。
- section heading 不进入 selection model，跨 section 的 keyboard navigation 保持连续。

**Non-Goals:**

- 不改变 provider score、结果总量、hydration 或搜索数据模型。
- 不实现 section collapse、workspace nested grouping 或虚拟列表。

## Decisions

### Decision 1: 在 SearchPalette 内构建 presentation groups

`visibleResults` 仍是唯一 selection truth。使用 pure projection 遍历结果，按固定 kind 顺序生成 non-empty groups，同时为每项保留原始 `resultIndex`。render 使用 `resultIndex === selectedIndex` 判断 active，点击仍直接传递原 `SearchResult`。

替代方案是在 unified search output 中注入 heading item，但这需要扩展 union、过滤不可选 rows，并会侵入 ranking / open action contract，因此拒绝。

### Decision 2: 分组采用产品内容顺序，组内保持 ranking 顺序

section 顺序与内容 filter 保持一致：file、kanban、thread、message、history、skill、command。组内只按输入顺序 append，不做二次排序，避免结果 relevance drift。

替代方案是按首个命中动态决定 section 顺序；它能让最高分结果所在组靠前，但同一 query 在数据更新时 section 会跳动，降低扫描稳定性，因此拒绝。

### Decision 3: file provider 负责 basename title

file provider 在构造 result 时用 `/[\\/]/` 兼容两类 separator，取最后一个非空 segment 作为 `title`；`filePath` 与 `locationLabel` 保持原 path。语义归一化发生在 provider，而不是 JSX 条件分支，使所有下游消费者得到正确的 display identity。

## Risks / Trade-offs

- [Risk] 固定 section 顺序会让全局最高分结果不一定出现在视觉首行 → Mitigation：组内 ranking 不变，content filters 仍可聚焦单一类型；该取舍换取稳定的信息架构。
- [Risk] section DOM 改变可能破坏 selected styling → Mitigation：保留原始 flat index，并用 focused test 覆盖跨 section selection 与 Enter action。
- [Risk] basename 相同的多个文件视觉标题重复 → Mitigation：完整 path 保留在 location metadata，workspace tag 继续区分项目。

## Migration Plan

1. 先调整 provider 与 unit test，锁定 title / path contract。
2. 再增加 grouping projection、i18n 与 CSS，并补 component tests。
3. 执行 focused tests、typecheck、lint、large-file 与 strict OpenSpec validation。
4. 回滚时恢复 provider title 和 palette flat render；无数据迁移。

## Open Questions

- 无。section collapse 与 workspace nested grouping 留待独立需求评估。
