## MODIFIED Requirements

### Requirement: Radar Entry Signal SHALL Remain Discoverable When Panel Is Collapsed
系统 MUST 在右侧面板收起时保留 radar 入口的运行态提示，避免用户错过进行中会话。该提示 MUST 呈现在「右侧面板展开 affordance」上（计数徽章形式），数据 MUST 复用既有 `sessionRadarFeed.runningSessions`，MUST NOT 新增 store 订阅、定时器或轮询。

#### Scenario: collapsed right panel still shows radar live hint
- **GIVEN** 存在至少一个进行中会话
- **WHEN** 右侧面板处于收起状态
- **THEN** 右侧面板展开 affordance MUST 呈现含 running 会话计数的可识别徽章
- **AND** 用户无需展开左侧项目树或右侧面板即可感知该状态

#### Scenario: badge is purely presentational
- **WHEN** 展开 affordance 呈现 running 计数徽章
- **THEN** 徽章 MUST NOT 自动展开面板、MUST NOT 抢占焦点
- **AND** 无 running 会话时 MUST NOT 渲染徽章
- **AND** 徽章 MUST 提供含计数的可访问名称

## ADDED Requirements

### Requirement: Radar Recent Persistence SHALL Be Bounded And Self-Pruning
`sessionRadar.recentCompleted` 持久化列表 MUST 有界：每条目按 `completedAt` 应用 30 天 TTL；每个 workspace 最多保留 50 条；全局最多保留 200 条，超出时淘汰最旧条目。修剪 MUST 在 merge 时惰性发生（无启动 migration、无 schema 变更），且物理移除条目时 MUST 同步清理 `dismissedCompletedAtById` 中不存在的 id。

#### Scenario: oversized legacy store converges on next merge
- **GIVEN** 旧版本写入的 recentCompleted 超过上限或包含过期条目
- **WHEN** 任意 merge（完成检测、删除、回写）发生
- **THEN** 系统 MUST 惰性修剪至边界内并持久化结果
- **AND** 被修剪条目的 dismissed 记录 MUST 一并清除

#### Scenario: bounded store keeps newest entries
- **WHEN** 新完成 entry 使全局数量超过上限
- **THEN** 系统 MUST 淘汰 `completedAt` 最旧的条目并保留最新条目

### Requirement: Radar Completion Reconcile MUST Recover Missed Completions
系统 MUST 补记因应用启动前已完成或跳变检测遗漏而未进入「最近完成」的会话。对 `isProcessing === false` 且 `updatedAt` 晚于已持久化 `completedAt` 的 thread，系统 MUST 补写完成 entry；补写 MUST 受 dismissed cutoff 保护，已被用户删除的完成记录 MUST NOT 复活。

#### Scenario: completion before app launch is recorded
- **GIVEN** 某 thread 在应用启动前已完成且无持久化完成记录
- **WHEN** radar feed 加载该 thread
- **THEN** 系统 MUST 以其 `updatedAt` 补写一条完成 entry
- **AND** 「最近完成」SHALL 展示该会话

#### Scenario: dismissed completion does not resurrect
- **GIVEN** 用户已删除某 thread 的完成记录（dismissed cutoff 已记录）
- **WHEN** reconcile 发现该 thread `updatedAt` 不晚于 cutoff
- **THEN** 系统 MUST NOT 补写完成 entry

### Requirement: Radar Panel Interaction Consistency
Radar 面板 MUST 提供一致的浏览与删除交互：最新日期组默认展开，其余日期组维持用户手动折叠态；未读与已读条目 MUST 同样可删除；删除失败 MUST 展示可恢复错误反馈；日期组整体删除 MUST 经二次确认；面板 MUST 响应外部历史管理变更（`SESSION_RADAR_HISTORY_UPDATED_EVENT`）同步未读态与折叠态。

#### Scenario: latest date group expanded by default
- **WHEN** 用户打开 Radar 面板且未手动操作折叠
- **THEN** 最新日期组 MUST 默认展开，其余日期组 MUST 默认折叠
- **AND** 用户手动折叠/展开的选择 MUST 被保留

#### Scenario: unread entry can be deleted directly
- **WHEN** 用户 hover 一条未读完成条目
- **THEN** 删除操作 MUST 可用，无需先标记已读或跳转

#### Scenario: delete failure is surfaced
- **WHEN** 删除操作部分或全部失败
- **THEN** 系统 MUST 展示 `role="alert"` 可恢复错误提示，MUST NOT 静默

#### Scenario: date-group deletion requires confirmation
- **WHEN** 用户触发某日期组的整体删除
- **THEN** 系统 MUST 先请求二次确认，确认后才执行删除

#### Scenario: external history management syncs panel state
- **WHEN** 设置页历史管理删除或修改 radar 历史并派发 `SESSION_RADAR_HISTORY_UPDATED_EVENT`
- **THEN** 已打开的 Radar 面板 MUST 即时同步未读标记与条目可见性

### Requirement: Activity Timeline Keyboard And Focus Accessibility
Activity 时间线 MUST 提供基础键盘与焦点可达性：diff 预览模态框 MUST 支持 Escape 关闭（脏状态 MUST 走既有 unsaved-changes 拦截链）、打开时焦点移入、关闭后焦点归还触发元素；声明 `role="tablist"` 的分类与产物 tab MUST 支持方向键导航与 roving tabindex，并与 `role="tabpanel"` 完成 `aria-controls` / `aria-labelledby` 配对。

#### Scenario: escape closes diff preview modal
- **WHEN** diff 预览模态框打开且用户按下 Escape
- **THEN** 无未保存修改时模态框 MUST 关闭且焦点归还触发卡片
- **AND** 有未保存修改时 MUST 先展示 `UnsavedChangesDialog`

#### Scenario: arrow keys navigate category tabs
- **WHEN** 焦点位于分类 tablist
- **THEN** `ArrowLeft` / `ArrowRight` MUST 移动并激活相邻 tab
- **AND** 非激活 tab MUST 保持 `tabIndex={-1}`（roving tabindex）

### Requirement: SOLO Follow Coach Auto-Dismiss MUST NOT Permanently Suppress
follow coach 气泡的自动消失 MUST 给予用户充足阅读时间（不少于 8 秒），且自动消失 MUST NOT 写入 `soloFollowCoachDismissedByWorkspace` 永久 suppress；仅用户显式点击关闭才 MUST 永久记录。

#### Scenario: auto-dismissed coach can reappear
- **WHEN** coach 气泡因超时自动消失
- **THEN** 同 workspace 后续满足触发条件时 coach MUST 可再次展示

#### Scenario: explicit dismiss remains permanent
- **WHEN** 用户点击 coach 的关闭动作
- **THEN** 系统 MUST 记录已读状态且同 workspace 不再弹出

### Requirement: Reasoning Auto-Follow MUST Yield To User Scroll
流式 reasoning 的自动滚底 MUST 在用户向上滚动超过阈值（48px）时暂停，并 MUST 提供「回到底部」悬浮入口；用户回到底部后 MUST 恢复自动跟随。

#### Scenario: user scroll up pauses follow
- **WHEN** reasoning 正在流式输出且用户向上滚动超过阈值
- **THEN** 系统 MUST 暂停自动滚底并显示「回到底部」按钮
- **AND** 用户点击该按钮或滚动回底部后 MUST 恢复跟随

### Requirement: Collapsed Turn Group SHALL Expose Summary Badges
折叠状态的 turn 分组 header MUST 展示摘要徽章（事件计数与文件变更 `+n/-m`），使用户无需展开即可扫读历史 turn 内容。摘要 MUST 按事件引用缓存计算，MUST NOT 在每次渲染全量重建。

#### Scenario: collapsed header shows artifact summary
- **WHEN** 某历史 turn 处于折叠状态
- **THEN** header MUST 展示事件计数与文件变更增删行数徽章
