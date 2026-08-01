## Why

Provider Continuation 已具有 authoritative `ConversationFamilyRef`，但 Sidebar 仍把来源与续接会话表现为互不相关的顶层条目，用户难以快速识别哪些会话共享同一条续接上下文。需要增加一种不改变 Parent-Child contract 的轻量视觉聚合，让血缘可见，同时继续与 Subagent Tree 严格隔离。

## 目标与边界

- 按 authoritative `familyId` 将同一 Conversation Family 的可见顶层 Session 连续排列。
- 使用带 label 与数量的轻围挡包裹 Family rows；围挡只表达“同一续接链”，不表达父子层级。
- 来源 Session、Provider Continuation 均保持独立可选、可恢复的顶层 Session。
- 保留现有 Origin、Engine、Provider、状态、时间、Pin、Context Menu 与 Subagent 行为。
- Family metadata 缺失、不完整或跨 workspace 时 fail open：维持普通顶层 row，不猜测关系。

## 非目标

- 不引入 Conversation Family 折叠、展开、树线或父子缩进。
- 不设置或复用 `parentThreadId`，不修改 Subagent relationship writer。
- 不改变 Provider Continuation 创建、Context Package、来源导航或恢复协议。
- 不按标题、时间、Provider 或内容相似度推断 Family。
- 不在本 change 中提供用户自定义 Family 名称、拖拽排序或 Family Context Menu。

## What Changes

- Sidebar projection 根据已持久化的 `familyId` / `familyRootSessionId` 生成 presentation-only Family group。
- 同组可见 rows 在当前 workspace / worktree / folder scope 内保持连续；组内遵循 lineage 顺序，缺少可靠 lineage 时使用现有稳定顺序。
- 至少两个可见成员时渲染轻围挡，label 使用“续接会话 · N 个”；单成员不渲染空壳分组。
- 轻围挡不得改变 row 的 DOM 语义、点击目标、键盘可达性和现有 active highlight。
- Virtualized 与 non-virtualized ThreadList 必须产生一致的 Family 分组语义。

## 技术方案比较

### Option A：轻围挡（采用）

按 `familyId` 生成 presentation group，以细边框、低对比背景和浮动 label 包裹连续 rows。关联清楚、视觉侵入低，且不使用树线或缩进，不易与 Subagent Tree 混淆。

### Option B：Family 卡片

使用更强背景、左侧强调线和固定 header。辨识度更高，但会与 workspace folder、active row 和 Subagent container 竞争视觉层级，窄 Sidebar 下偏重，因此拒绝。

### Option C：续接轨迹

使用左侧竖向 rail 串联 rows。空间占用最小，但 rail 容易被理解为 Parent-Child Tree 连接线，与现有 Subagent 语义冲突，因此拒绝。

## Capabilities

### New Capabilities

<!-- None. -->

### Modified Capabilities

- `workspace-session-catalog-projection`: 在保持 Provider Continuation 顶层身份的同时，允许按 authoritative Conversation Family 做 presentation-only 连续分组。
- `workspace-sidebar-visual-harmony`: 定义轻围挡的视觉层级、label、active state、窄宽度与 degraded fallback 契约。

## 验收标准

- 同一 workspace scope 内至少两个可见 Family members 被一个标有“续接会话 · N 个”的轻围挡包裹。
- 每个 member 仍是顶层 row；不得产生 Subagent class、tree expander、父子缩进或 `aria-expanded`。
- active、hover、focus、processing、unread、Provider label 与 Context Menu 行为在围挡内保持可见可用。
- Family member 缺失、被过滤、删除或归档时，count 只反映当前可见成员；少于两个时不展示围挡。
- 不同 workspace、worktree、session folder 或不同 `familyId` 不得被同一围挡合并。
- Virtualized 与 non-virtualized 列表的分组、顺序与选择行为通过 focused Vitest 覆盖。

## Impact

- Frontend：`ThreadList` 的可见 row projection、virtual item projection 与 Family group wrapper。
- Styling：Sidebar 轻围挡、label、窄宽度、theme 与 active/focus 状态。
- i18n：Family group label 与 accessible name。
- Tests：`ThreadList`、virtualized list、folder/worktree scope 和 Subagent regression。
- Backend/API/storage：无变化；复用现有 Conversation Family metadata。
- Dependencies：无新增依赖。
