## Why

Git History 提交区域目前只暴露自由文本搜索，虽然现有 `getGitCommitHistory` contract 已支持 branch、author 与 date range，但这些能力无法从主面板直接使用。现在需要把既有 backend 能力收敛成紧凑、可持久化的筛选栏，并阻止连续输入造成重复全仓 history scan 或 stale response 覆盖新结果。

## 目标与边界

- 在提交列表顶部提供文本/Hash、Branch、User、Date preset 与 Clear filters；结构化筛选嵌入“提交”标题行，搜索框独立位于下一行。
- 抽取 feature-local `GitHistoryCommitFilters`，不继续扩大 `GitHistoryPanelView` 的筛选 JSX。
- 所有筛选继续通过 `getGitCommitHistory` 在 backend 执行，保持分页总量、snapshot identity 与 remote daemon 语义正确。
- 文本与 author 输入使用 300ms debounce；branch/date/clear 立即应用。
- 筛选状态随 Git History panel persistence 保存；恢复时先 sanitize 再参与查询。
- history request 使用 generation guard，忽略 workspace、repository 或筛选切换后的 stale response。
- 每个 first-page request 创建新的 canonical payload；load-more 与 snapshot retry 复用该 payload，Date preset 在新 snapshot 生命周期重新锚定。
- remote daemon 与 Desktop backend 对 `"all"` / `"*"` branch scope 保持一致，避免 Web Service 模式把特殊值当普通 ref。

## 非目标

- 不实现 Regex、wildcard 或 case-sensitive 搜索。
- 不实现 path 筛选、完整 repository author 索引或新的 backend command；仅修复既有 daemon history command 的 branch parity。
- 不改变 commit graph topology、详情面板、push preview 或 File History 独立工作台。
- 不引入新依赖，不把筛选下沉为跨 feature shared component。

## What Changes

- 新增独立 `GitHistoryCommitFilters`，复用现有 inline picker 与 Git History theme tokens。
- 将搜索提示明确为“提交信息或 Hash”，增加 Branch、User、Date preset 和 Clear controls。
- 扩展 `GitHistoryPanelPersistedState`，保存 author 与 date preset；继续复用现有 `selectedBranch` 和 `commitQuery` source of truth。
- 将已应用的组合筛选映射到 `getGitCommitHistory` 的 `query/author/dateFrom/dateTo` 字段；first page 与 snapshot-expired retry 使用同一 payload builder。
- 修复 inline picker 的 positioning context 与窄列对齐，使 Branch/Date dropdown 始终锚定各自 trigger 且不溢出 commit column。
- User 使用完整或部分 email 筛选且 display name 不命中时，在提交 metadata 中显示匹配 email，保持 filter identity 与结果身份可核对。
- 增加 300ms debounce、epoch-second date range resolver、snapshot-stable date anchor 与 history request generation guard。
- Clear 与 workspace scope 切换同步取消 stale draft debounce，避免已清空或旧 workspace 条件被延迟重新应用。
- remote daemon 对 all-branches scope 使用 local/remote ref glob，与 Desktop backend 行为一致。
- 增加 component、pure helper、persistence/payload 与 stale-response regression coverage。

## 方案对比与取舍

1. **独立 controlled filter component + local debounced drafts（采用）**：输入期间只重渲染筛选组件，300ms 后才更新 panel applied state，兼顾交互响应与 server-side pagination 正确性；代价是组件需要同步 external clear/restore。
2. **所有输入直接写入 `GitHistoryPanelImpl` state（不采用）**：改动更少，但每次击键都会重渲染大型 panel 并触发 backend scan，放大现有性能与 race 风险。
3. **只对首屏 100 条 commits 做 client-side filtering（不采用）**：视觉响应快，但 total、分页与 load-more 结果错误，违反现有 history contract。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `git-commit-history`: 扩展 Structured Filters、Search、Selection/Persistence 与 stable pagination 行为，使主面板可组合使用 author/date，并明确 debounce、clear 与 stale-response contract。

## 验收标准

- 用户可组合使用文本/Hash、Branch、User 与 Date preset。
- 文本、User 连续输入只在 300ms settle 后触发一次最新查询；旧请求不得覆盖新结果。
- Date preset 在同一 snapshot pagination 生命周期内使用稳定的 epoch-second `dateFrom/dateTo`。
- load-more 与 snapshot-expired retry 使用与首屏完全相同的筛选 payload。
- Clear filters 清空 query/author/date，并回到当前 branch；左侧 branch list 与筛选 chip 保持同一 state。
- Branch/User/Date/Clear 与“提交”标题位于同一 header 容器；搜索框独立位于下一行，dropdown 不得脱离 trigger 出现在面板左下角。
- email author filter 命中不同 display name 时，提交 metadata 显示对应 email。
- panel 关闭/重开后恢复已应用筛选，损坏的 date preset 回退到 `all`。
- focused Vitest、typecheck、lint、runtime contract 与 strict OpenSpec validation 通过。

## Impact

- Frontend component/state: `src/features/git-history/components/git-history-panel/**`
- Persistence: `GitHistoryPanelPersistedState`
- Service contract: 复用 `src/services/tauri.test.ts` 既有 `getGitCommitHistory` payload coverage，无需修改 service 层
- Styles/i18n: `src/styles/git-history.part1.css`, `src/i18n/locales/*/git.ts`
- Backend/API/dependencies: 修复 `cc_gui_daemon` 既有 branch 解析，无新增 command、DTO 或 dependency
