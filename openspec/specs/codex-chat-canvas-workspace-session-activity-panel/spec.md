# codex-chat-canvas-workspace-session-activity-panel Specification

## Purpose

为 chat canvas 右侧区域提供一个 workspace 级多 session 实时活动监控面板，聚合当前任务上下文中的主 session 与派生子 session，减少用户在幕布、status panel、runtime console 之间来回切换。
## Requirements
### Requirement: Right Panel Workspace Session Activity Entry

系统 MUST **不再**在右侧 panel 体系中向用户暴露可用的 workspace session activity 入口（runtime disabled）。

#### Scenario: right panel does not expose activity tab

- **WHEN** 用户进入支持 chat canvas 的 workspace
- **THEN** 右侧区域 MUST NOT 提供可用的 `activity` /「会话活动」面板入口
- **AND** Git、Files、Search、Radar、Notes 等其余 panel MUST 保持原有访问方式

#### Scenario: adding activity panel does not replace existing right-side capabilities

- **WHEN** activity 能力处于 disabled 状态
- **THEN** Git、Files、Search、Memory、Radar 等现有 panel MUST 保持原有访问方式与核心行为
- **AND** 系统 MUST NOT 因 activity 下线而移除或替换 runtime console / 消息区工具卡片

#### Scenario: solo mode is disabled as activity container

- **WHEN** 产品曾使用 `SOLO` 作为 activity 监控容器
- **THEN** 系统 MUST NOT 提供可用的 Solo 进入入口
- **AND** 系统 MUST NOT 因 session 进入运行态自动切入 Solo
- **AND** 若本地残留 Solo 态，系统 MUST 在下一次布局 resolve 时退出 Solo

### Requirement: Relevant Session Scope Is Root-Subtree Bound

当 activity 派生未运行时，本 requirement 不适用运行时聚合；若未来重新启用，MUST 仍仅聚合 active thread root-subtree。

#### Scenario: activity derivation is not running while disabled

- **GIVEN** session activity 处于 runtime disabled
- **WHEN** 对话流式更新 items
- **THEN** 系统 MUST NOT 为 activity 面板维护 live timeline 派生
- **AND** Radar 会话跟踪 MUST 不受影响、继续按既有 radar contract 工作

### Requirement: Multi-Session Timeline Coverage

在 runtime disabled 期间，系统 MUST NOT 渲染 workspace session activity 多会话时间线 UI。

#### Scenario: panel is not mounted

- **WHEN** 用户尝试打开 activity（含旧快捷键、旧 `filePanelMode` 残留）
- **THEN** 系统 MUST NOT 挂载 `WorkspaceSessionActivityPanel` 作为可用主视图
- **AND** 系统 MUST 将右侧面板 normalize 到安全模式（例如 files）
- **AND** 系统 MUST NOT crash

### Requirement: Realtime Incremental Refresh

在 runtime disabled 期间，系统 MUST NOT 为 activity 执行增量 timeline 刷新逻辑。

#### Scenario: streaming does not rebuild activity view model

- **GIVEN** session activity 处于 runtime disabled
- **WHEN** 相关 session 产生 tool / file-change 事件
- **THEN** 系统 MUST NOT 调用 `useWorkspaceSessionActivity` 进行全量或增量重建
- **AND** 主对话渲染 MUST 保持可用

### Requirement: Session Provenance and Jump Actions

每条活动 MUST 暴露 session 来源，并 SHOULD 提供跳转到现有详情视图的入口；对于文件修改事件，右侧 activity panel MUST 展示完整文件集合，而不是只保留压缩摘要。

#### Scenario: file-change event exposes complete file list

- **WHEN** activity panel 渲染一次包含多个文件的 `file-change` 事件
- **THEN** 该事件 MAY 保留 event-level summary
- **AND** 展开态 MUST 展示该次变更涉及的全部文件
- **AND** 文件数量 MUST 与对应消息幕布 `File changes` 卡片保持一致

#### Scenario: file rows show canonical per-file diff stats

- **WHEN** activity panel 渲染某个 `file-change` 事件下的文件条目
- **THEN** 每个文件条目 MUST 展示该文件的路径与 `additions / deletions` 摘要
- **AND** 这些统计 MUST 来自共享 canonical file-change source

#### Scenario: historical activity panel keeps complete file list after reopen

- **WHEN** 用户重新打开一个历史上已展示过多文件 `file-change` 的 `Codex` 会话
- **THEN** activity panel MUST 继续展示完整文件列表
- **AND** MUST NOT 在历史 reopening 后退化为只展示 primary file summary

### Requirement: Stable Empty Running and Completed States

activity panel MUST 为无数据、执行中、执行完成三种状态提供稳定反馈。

#### Scenario: empty state explains no activity yet

- **WHEN** 当前任务上下文尚未产生任何可展示活动
- **THEN** activity panel MUST 显示清晰空态提示
- **AND** 该空态 MUST 明确说明“当前尚无 session activity”

#### Scenario: completed state remains inspectable after execution finishes

- **WHEN** 当前任务的相关 session 已完成执行
- **THEN** activity panel MUST 保留最近活动的可查看时间线
- **AND** 面板 MUST 提供完成态语义，而不是回退为空态

### Requirement: Stable Timeline Scanning At Large Event Counts

activity panel 在大 timeline 场景下 MUST 保持稳定可扫描，不能因旧事件过多而压垮当前回合的可读性。

#### Scenario: latest turn stays expanded while older turns stay collapsed by default

- **GIVEN** 当前 timeline 已存在多个 turn groups
- **WHEN** 用户打开 activity panel 或有新的最新 turn 到来
- **THEN** 最新 turn group MUST 默认展开
- **AND** 较早的 turn groups MUST 默认折叠，除非用户手动展开

#### Scenario: turn group folding survives realtime refresh

- **WHEN** activity panel 在运行中持续接收新的 events
- **THEN** 系统 MUST 维持用户已手动切换过的 turn group 折叠状态
- **AND** MUST NOT 因增量刷新把所有历史 turn groups 重新展开

### Requirement: SOLO View Exit Does Not Interrupt Execution

如果系统使用 `SOLO` 视图模式承载 activity 监控，则退出该视图 MUST NOT 中断底层 session 执行。

#### Scenario: user can leave solo while task is still running

- **WHEN** 用户处于 `SOLO` 视图
- **AND** 当前相关 session 仍在运行中
- **THEN** 系统 MUST 允许用户切回普通视图
- **AND** 切回操作 MUST NOT 中断命令、任务或文件修改流程

#### Scenario: re-entering solo restores current activity context

- **WHEN** 用户在运行中或运行后重新进入 `SOLO` 视图
- **THEN** 系统 SHOULD 恢复当前任务的 activity 上下文
- **AND** MUST NOT 将视图错误重置为初始空态

### Requirement: Adapter Boundary and Legacy Isolation

新 capability MUST 通过独立 adapter / selector / panel 模块实现，不得把 workspace 聚合逻辑侵入旧 UI 链路。

#### Scenario: activity panel consumes adapter view model instead of legacy ui output

- **WHEN** 实现 workspace session activity panel
- **THEN** 新面板 MUST 消费独立 adapter 输出的纯数据 view model
- **AND** MUST NOT 直接依赖旧 `StatusPanel` 或 `toolBlocks` 的 JSX 结构

#### Scenario: legacy single-thread surfaces remain scoped to their original responsibilities

- **WHEN** 新 capability 接入后
- **THEN** 旧的 `StatusPanel`、消息区 `tool cards`、`thread reducer` MUST 保持原有职责边界
- **AND** 仅允许发生只读 selector 暴露或纯函数抽取这类向后兼容的最小适配

### Requirement: Live Edit Preview Is Out Of Scope For Phase One

由 file-change event 反向驱动 editor/file view 自动打开文件的能力 MUST NOT 作为本提案第一阶段的默认行为。

#### Scenario: activity panel does not auto-steal editor focus by default

- **WHEN** 相关 session 产生新的 file-change event
- **THEN** activity panel MUST 默认仅展示事件与跳转入口
- **AND** 系统 MUST NOT 未经用户明确启用就自动抢占当前 editor 或 file view 焦点

#### Scenario: future live preview requires separate opt-in contract

- **WHEN** 后续产品决定支持“实时编辑预览”
- **THEN** 该能力 SHOULD 通过独立 capability 或显式 opt-in 契约定义
- **AND** 必须约束关闭开关、焦点抢占策略与界面抖动控制

### Requirement: Codex History Reopen Keeps Activity Panel Continuity

对于 `Codex` 会话，右侧 `session activity` 面板 MUST 在历史 reopening 场景下保持与实时阶段连续，不得退化为空态。

#### Scenario: historical codex activity panel replays prior visible activity

- **WHEN** 用户重新打开一个在实时阶段已经展示过 `reasoning`、命令或文件修改活动的 `Codex` 会话
- **THEN** 右侧 `session activity` MUST 重放这些已展示活动
- **AND** 面板 MUST NOT 因历史载荷退化而回退到“当前尚无 session activity”空态

#### Scenario: activity panel continuity prefers richer reconstructed facts

- **WHEN** `resumeThread` 与本地历史 replay 同时提供同一 `Codex` 活动的部分信息
- **THEN** 面板数据源 MUST 采用更丰富的事实版本
- **AND** 状态更新、文件路径与命令摘要 MUST 与实时阶段保持语义一致

### Requirement: Codex History Reopen Preserves Child Session Topology

对于 `Codex` 会话，`session activity` 在历史 reopening 场景 MUST 保持与实时阶段一致的子会话拓扑，不得仅展示 root session。

#### Scenario: history reopen keeps previously visible child sessions

- **GIVEN** 某个 `Codex` 会话在实时阶段出现过至少一个 child session
- **WHEN** 用户关闭后重新打开该会话
- **THEN** `session activity` MUST 继续显示这些 child sessions
- **AND** 相关 child session 的关键活动 MUST 仍可在聚合时间线中被查看

#### Scenario: topology recovery uses persisted collaboration facts when direct parent map is sparse

- **GIVEN** 历史恢复时 `threadParentById` 不完整
- **AND** 历史记录中存在可解析的协作调用事实
- **WHEN** 面板构建 root-subtree 相关线程范围
- **THEN** 系统 MUST 基于这些协作事实恢复 child session 归属
- **AND** MUST NOT 将已执行过的 child session 误判为无关线程

#### Scenario: no fabricated child session in root-only history

- **GIVEN** 某个 `Codex` 会话历史中从未创建 child session
- **WHEN** 用户打开 `session activity`
- **THEN** 面板 MUST 仅展示 root session
- **AND** 系统 MUST NOT 伪造不存在的 child session 关系

### Requirement: File-Change Jump MUST Route By Path Domain Without Regressing Workspace Flow
The system SHALL route `File change` jump targets by path domain and MUST preserve existing workspace file-open behavior.

#### Scenario: Workspace file path keeps existing open pipeline
- **WHEN** a `File change` event path resolves inside active workspace root
- **THEN** the system SHALL keep using the existing workspace file open/read pipeline
- **AND** no additional external-spec routing SHALL be applied

#### Scenario: External spec path uses external spec read route
- **GIVEN** an active external spec root is visible in session context
- **WHEN** a `File change` event path resolves inside that external spec root but outside workspace root
- **THEN** the system SHALL open the file through the external spec read route
- **AND** the editor surface SHALL present content without triggering `Invalid file path`

#### Scenario: External absolute path uses external absolute read route
- **WHEN** a `File change` event path resolves to an absolute file path outside both workspace root and active external spec root
- **AND** the target file is readable
- **THEN** the system SHALL open the file through the external absolute read route
- **AND** the editor surface SHALL present content without triggering `Invalid file path`

#### Scenario: Unsupported external path fails safely
- **WHEN** a `File change` event path is outside recognized path domains or is not readable
- **THEN** the system SHALL show a recoverable hint
- **AND** session activity interaction SHALL remain available without crash

#### Scenario: Cross-platform path normalization is honored
- **WHEN** path matching is evaluated on macOS or Windows
- **THEN** the system SHALL normalize path separators before comparison
- **AND** Windows drive-letter comparisons SHALL be case-insensitive

### Requirement: Right Panel Tabs SHALL Expose Global Radar Entry
系统 MUST 在右侧顶部 Tab 提供独立 `Radar` 入口，作为跨项目会话总览主入口。

#### Scenario: user opens radar from top-level tab
- **WHEN** 用户点击顶部 `Radar` 入口
- **THEN** 面板 SHALL 打开跨项目聚合视图
- **AND** 用户 SHALL 能区分进行中与最近完成分组
- **AND** 数据来源 MUST 以 `workspaceId + threadId` 作为会话身份主键

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

### Requirement: SOLO Follow Entry MUST Be Self-Explanatory
`session activity` 区域中的 `SOLO` 跟随入口 MUST 具备可见语义，帮助首次用户在不依赖图标记忆的情况下理解该能力用途。

#### Scenario: entry renders icon label and tooltip as a combined affordance
- **WHEN** 用户打开 `session activity` 面板
- **THEN** `SOLO` 跟随入口 MUST 同时呈现 icon 与可见文本标签
- **AND** 入口 MUST 提供可读 tooltip，明确“开启后将实时打开 AI 正在修改的文件”
- **AND** 入口 MUST 提供可访问名称，支持键盘焦点与读屏识别

#### Scenario: discoverability enhancement does not auto-enable follow
- **WHEN** 用户仅看到入口文案、tooltip 或其他引导提示
- **THEN** 系统 MUST NOT 自动开启 `SOLO` 跟随
- **AND** 系统 MUST NOT 自动抢占 editor 焦点

### Requirement: SOLO Follow Onboarding MUST Support One-Time Guided Discovery
系统 MUST 为首次进入 `session activity` 的用户提供一次性引导，明确 `SOLO` 跟随能力位置与作用。

#### Scenario: first-time coach mark appears once per user workspace context
- **WHEN** 用户首次进入某 workspace 的 `session activity`
- **THEN** 系统 MUST 展示指向 `SOLO` 跟随入口的一次性 `coach mark`
- **AND** 用户关闭后，系统 MUST 记录已读状态并在同用户同 workspace 不重复弹出

#### Scenario: reopening panel after dismissal does not re-trigger onboarding
- **WHEN** 用户已关闭该 workspace 的首次引导后再次打开 `session activity`
- **THEN** 系统 MUST NOT 再次展示该首次 `coach mark`

### Requirement: SOLO Follow Nudge MUST Trigger On File-Change Context With Frequency Guard
当用户尚未开启 `SOLO` 跟随且 AI 产生日志中的文件修改事件时，系统 MUST 提供情境提示，并通过频控避免过度打扰。

#### Scenario: contextual toast appears on first file-change while follow is off
- **WHEN** 当前会话出现新的 `file-change` 事件且 `SOLO` 跟随未开启
- **THEN** 系统 MUST 展示情境 toast 提示用户开启实时跟随
- **AND** toast MUST 提供 `开启` 与 `稍后` 两个动作

#### Scenario: choosing later suppresses repeated nudge in same turn
- **WHEN** 用户在当前轮次点击 toast 的 `稍后`
- **THEN** 系统 MUST 在该轮次内抑制重复 toast
- **AND** 仅在后续出现新轮次 `file-change` 时，系统才可再次提示

#### Scenario: clicking enable activates follow without dropping current session context
- **WHEN** 用户点击 toast 的 `开启`
- **THEN** 系统 MUST 切换到 `SOLO` 跟随开启状态
- **AND** 后续 `file-change` 事件 MUST 进入实时跟随打开链路
- **AND** 切换行为 MUST 保持当前会话上下文，不得导致 timeline 数据重置

### Requirement: SOLO Follow Chain Actions MUST Remain Recoverable
系统 MUST 支持在同一管理会话中连续执行“提示 -> 开启/稍后 -> 再次提示/重试开启”操作链，并保证失败可恢复。

#### Scenario: follow can be re-enabled after manual disable in later file-change round
- **WHEN** 用户手动关闭 `SOLO` 跟随后，后续再次出现新轮次 `file-change`
- **THEN** 系统 MUST 按频控规则重新允许情境提示
- **AND** 用户 MUST 可再次开启 `SOLO` 跟随

#### Scenario: enable failure keeps interface stable and allows retry
- **WHEN** 用户触发 `开启` 但跟随状态切换失败
- **THEN** 系统 MUST 展示可恢复错误反馈
- **AND** 系统 MUST 保持当前视图稳定，不得出现焦点跳闪或面板崩溃
- **AND** 用户 MUST 可在同会话直接重试开启

#### Scenario: consecutive file-change events do not cause duplicate-open jitter
- **WHEN** `SOLO` 跟随已开启且 AI 在短时间内连续产生多个 `file-change` 事件
- **THEN** 系统 MUST 按事件顺序更新跟随目标
- **AND** 系统 MUST NOT 因重复事件导致同一文件的可见重复打开抖动

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

### Requirement: Session Activity And Solo Runtime Kill-Switch

系统 MUST 提供明确的 runtime kill-switch，使会话活动与 Solo 同时不可用，且不删除雷达能力。

#### Scenario: kill-switch hides activity and solo together

- **WHEN** kill-switch 生效（本 change 默认生效）
- **THEN** activity 入口与 Solo 入口均不可用
- **AND** Radar 入口与 radar 数据路径 MUST 仍可用

#### Scenario: persisted activity mode is sanitized

- **WHEN** 客户端存储中 `filePanelMode` 为 `activity` 或 Solo 标记为开启
- **THEN** 系统 MUST 在布局解析时纠正为非 activity 安全状态
- **AND** MUST NOT 保留半开 Solo + activity 组合
