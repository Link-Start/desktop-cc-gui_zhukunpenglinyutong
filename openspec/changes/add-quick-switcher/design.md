## Context

客户端已有 `⌘O` Global Search、desktop titlebar icon、workspace thread summaries、workspace file tabs、Session Activity file-change facts 与 client store。Quick Switcher 需要复用这些事实和导航 callback，但不能把空查询 recent UI 塞进 Search Palette，也不能向 App Shell 根链引入高频更新。

当前约束：

- React 19 + TypeScript + lazy feature views；UI 文案必须 i18n。
- App Shell 存在明确的 render/layout domain boundaries，新功能应保持 feature-local。
- 高频文件/活动事件不得逐事件扩散为根级 append-only state。
- 用户要求不提供搜索框，最近会话和最近文件各最多 30 条、按时间倒序。

## Goals / Non-Goals

**Goals:**

- 提供 desktop-only、icon + `⌘E` / `Ctrl+E` 可达的三栏 Quick Switcher。
- 左栏是有限的核心 navigation destinations；中栏、右栏并行显示最近会话和最近文件，并在各栏内按 workspace 分组。
- 建立可信、持久、workspace-scoped 的 recent-file MRU，并接入用户打开和 AI completed file-change 两类事件。
- 保持组件 lazy-loaded，关闭时不订阅高成本数据、不渲染列表。

**Non-Goals:**

- 不实现 query/filter/index/provider。
- 不改变 Search Palette、file editor、thread lifecycle 或 backend contract。
- 不提供跨 workspace 扁平混排；跨 workspace recent items 必须保留 workspace hierarchy。
- 不新增 dependency，也不重构无关 App Shell domain。

## Decisions

### 1. 独立 Quick Switcher feature，而不是 Search Palette 空查询态

采用 `src/features/quick-switcher/**` 和独立 lazy view。Search Palette 继续表达“主动检索”，Quick Switcher 表达“恢复最近上下文”。

替代方案是扩展 Search Palette 空查询态；拒绝原因是会混合两套产品语义，并增加现有 search hydration/root render 路径负担。

### 2. Recent-file MRU 使用已有 client store，事件写入、派生读取

MRU entry：

```ts
type QuickSwitcherRecentFile = {
  workspaceId: string;
  path: string;
  touchedAt: number;
  source: "opened" | "ai-modified";
  aiModifiedAt?: number;
};
```

- identity 为 `workspaceId + normalized path`。
- 每次写入合并同 identity 并刷新 `touchedAt`，倒序裁剪到 30 条。
- user open/activate 记录 `source=opened`；已有 `aiModifiedAt` 保留，以便显示 Sparkles indicator。
- AI file change 来自 `WorkspaceSessionActivityViewModel.timeline` 中 `kind=fileChange && status=completed` 的 `filePath/fileChanges`，使用 `occurredAt`，`D` 删除记录，`A/M/R` 写入。
- read/search/mention 不进入 timeline completed file-change contract，因此不写入。
- storage normalization 对 unknown 输入 fail closed；无独立 migration。

替代方案是只显示 `openFileTabs`；拒绝原因是关闭 tab 即丢失、跨重启不可用、AI 修改未打开文件不可见。

### 3. 最近会话直接派生，不建立第二套 session MRU

所有已加载 workspace 的 `ThreadSummary[]` 合并后按 `updatedAt` 倒序取全局前 30 条，再按 workspace 分组。workspace group 按组内最新 item 时间倒序；组内仍按 item 时间倒序。ThreadSummary 已是持久、跨重启、engine-aware 的事实源；复制一份 activation history 会造成一致性问题。

### 4. UI 使用有限高度、三栏并行和 pane-scoped selection model

- panel header 仅包含标题与 shortcut badge，无 input。
- body 左侧为 navigation list，中栏为 `最近会话`，右栏为 `最近文件`。
- 两个 recent pane 独立滚动；workspace group heading sticky/明确缩进，group heading 不占 selection index。
- sessions/files 各自先取全局最新 30 条，再按 workspace 分组，避免每 workspace 30 条造成 DOM 无界增长。
- `←/→` 在三栏切换 pane，`↑/↓` 在当前栏循环选择，`Enter` 激活，`Esc` 关闭。
- 当前 active file/thread 仍展示；初始 selection 优先选择当前项之后的第一项，便于快速往返。
- 文件使用现有 file icon helper；会话使用 EngineIcon/SharedSessionIcon；AI 修改增加 Sparkles indicator。

### 5. 样式和 bundle 遵循现有 feature loader

Quick Switcher 组件与 CSS 只在打开时加载。视觉使用现有 theme tokens、紧凑 density、1px border、有限 shadow；不新增字体、渐变或装饰性 animation。

### 6. Navigation 必须调用 canonical open action

- Spec Hub 调用现有 `handleOpenSpecHub`，由它创建或聚焦 detached Spec Hub window；禁止继续写 `activeTab="spec"`。
- 意图画布调用 `handleOpenIntentCanvas`；项目地图调用 `handleOpenProjectMap`。
- Quick Switcher 在 `useAppShellLayoutNodesSection` 组合这些已存在 action，并覆盖基础 navigation dispatch；不复制窗口/session payload 构建逻辑。

## Data Flow

```text
user opens/activates file ─┐
                           ├─ recordRecentFile → client store MRU → Quick Switcher file section
completed activity change ─┘

threadsByWorkspace[all loaded workspaces]
  → global sort updatedAt desc → top 30 → group by workspace → session pane

recentFilesByWorkspace
  → global sort touchedAt desc → top 30 → group by workspace → file pane

navigation row / session / file activation
  → existing App Shell callback → close popup
```

## Risks / Trade-offs

- [Risk] 会话 `updatedAt` 表达最近内容更新，而非纯查看时间。→ 复用 canonical fact，避免新增 session MRU；后续若有明确需求再扩展 activation timestamp。
- [Risk] 一次 AI event 包含大量文件。→ 单次合并后统一排序裁剪 30 条，只触发一次 debounced client-store write。
- [Risk] stored path 已被外部删除。→ 打开失败沿用现有 file-open error；AI delete event 主动移除已知记录。本变更不为 30 条记录增加逐次 filesystem stat。
- [Risk] 60 条右栏内容影响首开。→ component lazy-loaded、纯数组派生、有限 DOM；不开启时不挂载。
- [Risk] App Shell wiring 扩大。→ 只新增明确 typed boundary 字段，不夹带已有 `any` 清理或无关重构。

## Migration Plan

1. 新增 OpenSpec contract 与 feature-local model/tests。
2. 接入 client store MRU 和 AI activity projection。
3. 接入 icon、shortcut、lazy view 与现有 navigation callbacks。
4. 运行 focused tests、targeted lint/typecheck、OpenSpec strict validation。

Rollback：移除 Quick Switcher入口、feature wiring、storage key 使用与 lazy view；既有 Search Palette、thread/file state 不受影响。遗留 client-store key 为无害数据，也可在后续 cleanup 中删除。

## Open Questions

无。已由用户确认：无搜索框；最近会话和最近文件分类展示；两组各最多 30 条；最新在上；AI 实际修改文件计入最近文件。
