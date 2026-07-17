## Context

`GitHistoryPanelImpl` 已维护 `selectedBranch`、`commitQuery`、pagination snapshot 与 panel persistence，但 `GitHistoryPanelView` 只渲染一个直接受控的搜索框。`getGitCommitHistory` service 与 Desktop/daemon backend 已接受 `query`、`author`、`dateFrom` 与 `dateTo`，因此本次不需要新增 runtime contract；真正缺口是 UI surface、applied filter state、debounce 与 async race protection。

当前 panel 通过 `renderGitHistoryPanelView(scope)` 传递大量状态，且 commit list 使用 virtualization。筛选实现必须保持 branch list 与 branch chip 的 single source of truth，不能用 client-side filtering 破坏 page total，也不能让 input draft 的每次击键重渲染整个 panel 并触发全仓 revwalk。

## Goals / Non-Goals

**Goals:**

- 抽取 feature-local `GitHistoryCommitFilters`，提供紧凑且 keyboard-accessible 的 search + filter controls。
- 复用现有 `GitHistoryInlinePicker` 展示 Branch 和 Date preset，User 使用可清空输入。
- Branch/User/Date/Clear 嵌入与“提交”标题相同的 column header；search 独立位于下一行，picker dropdown 使用 trigger-local positioning context。
- 完整或部分 email filter 命中不同 author display name 时，在 commit metadata 中显式显示 email。
- 将 free-text draft 隔离在 filter child，300ms 后才发布 applied filters。
- 使用一个 canonical payload builder 保证 initial、load-more 与 snapshot retry 参数一致。
- 使用 generation guard 拒绝 repository、workspace 与 filter 切换后的 stale history response。
- 扩展 panel persistence，并对 date preset 做 runtime sanitize。

**Non-Goals:**

- Regex、case-sensitive、自定义日期区间与 path filter。
- 新 backend command、作者索引、branch topology 或 File History 合并。
- 跨 feature shared filter framework。

## Decisions

### Decision 1: Child-local drafts，parent 只持有 applied filters

`GitHistoryCommitFilters` 内部维护 query/author draft，并在 300ms settle 后通过一个 `onFiltersChange(next)` 发布。Branch、Date 和 Clear 属于离散操作，立即发布。Clear 先同步清空 child draft 再通知 parent；workspace scope key 进入 draft sync 与 debounce cleanup dependency，保证旧 scope timer 不会污染新 workspace。

这避免每次击键都更新 `GitHistoryPanelImpl`，同时 parent 中的 `commitQuery/commitAuthor/commitDatePreset` 仍是 backend request 与 persistence 的 applied source of truth。External restore/clear/scope switch 通过 effect 将 props 同步回 draft；scope 切换即使恢复值相同，也必须取消旧 debounce。

Alternative：在 parent 使用 `useDebouncedValue`。实现更直接，但 draft state 仍会让大型 panel 每次击键 rerender。

### Decision 2: Date preset 解析为 first-page anchored、snapshot-stable epoch-second range

新增 pure resolver 将 `all/today/7d/30d` 转为 `{ dateFrom, dateTo }`。每个 first-page request 创建一次 canonical payload 并重新锚定 range；pagination 与 snapshot-expired retry 从 ref 复用同一组秒级时间戳。这样手动刷新或跨过本地午夜后的新 snapshot 使用新时间边界，同时同一 snapshot 生命周期保持 request identity 稳定。

Alternative：只在 preset 变化时计算。这会让 Today 跨午夜与 rolling window 在手动刷新后仍使用旧边界；每次 append 动态计算则会破坏 snapshot identity。

### Decision 3: 复用既有 backend contract，并补齐 daemon branch parity

Parent 将所有 applied filters 映射到 `getGitCommitHistory`。Path 不进入本次主面板筛选 surface，避免低频能力占用紧凑工具栏。Desktop 已将 `"all"` / `"*"` 解析为 `refs/heads/*` 与 `refs/remotes/*`，daemon 必须采用相同 branch scope 语义，不能把特殊值送进 `push_ref`。

Alternative：过滤当前 `commits`。只覆盖已加载 page，total 与 load-more 错误，因此不采用。

### Decision 4: First-page request 提升 generation，append 继承 generation

每次 `loadHistory(false)` 增加 `historyRequestGenerationRef`；append 捕获当前 generation。所有 response、error、loading settle 在写 state 前检查 generation。新 first-page request 同时清空 snapshot ref，避免 filter 切换期间 append 误用旧 snapshot。

Alternative：只依赖 React effect cleanup。`loadHistory` 还被 refresh/load-more/operation handler 直接调用，单个 effect cancellation 无法覆盖全部入口。

### Decision 5: Branch chip 与左侧分支树共享 `selectedBranch`

Filter component 只接收 `selectedBranch` 和 `onBranchChange`，不维护第二份 branch applied state。Clear 使用 `currentBranch ?? "all"`，并清空 query/author/date。

Alternative：chip 独立 branch state。会造成左侧高亮、backend payload 和 persistence 漂移。

### Decision 6: Author suggestions 只作为非权威辅助

从当前 loaded commits 派生 normalized unique author labels，通过 datalist/option suggestion 提示，但输入仍接受任意值。UI 不把有限 page suggestions 表述为完整作者列表。当 active author filter 命中 email、但不命中 display name 时，commit metadata 显示该 email，避免 display name 与筛选值看起来不一致。该判定不依赖输入是否已包含 `@`，因此部分 email 过滤也可核对。

Alternative：新增 list-authors backend command。超出 MVP，且会额外扫描 history。

## Risks / Trade-offs

- [Risk] loaded commits 的 author suggestions 不完整 → 输入保持 free-form，并避免“全部作者”文案。
- [Risk] `today` 依赖本地时区 → 从 local midnight 计算并发送 epoch seconds，Desktop/daemon 接收同一绝对范围。
- [Risk] filter component local draft 与 external persistence restore 漂移 → prop change effect 只在值不同时同步 draft，并覆盖 clear/workspace switch 测试。
- [Risk] narrow commit column 的 Date dropdown 向右溢出 → Date picker 使用 end alignment；输入补齐 `name`、`autoComplete` 与 `spellCheck` contract。
- [Risk] Desktop/daemon branch 行为漂移 → daemon all-branches Rust regression 固化 local + remote ref coverage。
- [Risk] giant scope object 增加字段 → 仅传递一个 `commitFilters` value、一个 options collection 与少量 handlers，不把 draft state暴露回 scope。

## Migration Plan

1. 增加 filter types、date resolver 与 focused unit tests。
2. 增加独立 filter component、scoped styles 与 i18n。
3. 扩展 persisted state 和 parent applied filter state。
4. 建立 first-page canonical request options ref，接入 generation guard 与 snapshot reset。
5. 将结构化筛选移动到 search 上方，修复 picker anchor，并增加 author identity 可核对展示。
6. 补齐 clear/scope debounce、date re-anchor、partial email 与 daemon all-branches regression。
7. 增加 component/payload/race tests并执行 gates。

Rollback 移除 filter component 与新增 persisted fields，恢复原搜索框；backend contract 无变化，不涉及数据迁移。旧 client-store object 的新增 optional fields 可安全忽略。

## Open Questions

- 无阻塞问题。自定义日期区间、Regex 与完整 author index 留待独立 change。
