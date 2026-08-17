## ADDED Requirements

### Requirement: Runtime workspace list hydration MUST cooperatively abandon after cancel/stale

当 `listThreadsForWorkspace` 通过 startup orchestrator（或等价路径）携带 `isStale` 时，在 `isStale() === true` 或 requestSeq 已过期后，实现 MUST 协作式放弃后续重活：MUST NOT 启动新的 thread-list 相关 IPC 阶段（含 titles 之后的 shared list、codex 分页下一页、project catalog / Claude seed / OpenCode list 启动、gemini/kimi/grok 会话刷新），MUST NOT 对过期请求 `setThreads`。

已在途的单次 IPC 完成后 MUST 在下一检查点 return，不得继续 fan-out。

#### Scenario: cancel mid-list stops further stages

- **WHEN** workspace A 的 list hydration 已开始且仍在 titles/shared/paging 之间
- **AND** 用户切换到 workspace B 导致 A 的 generation `isStale`
- **THEN** A 的 list body MUST 在下一检查点 return `{ applied: false, stale: true }`（或等价）
- **AND** MUST NOT 再发起 A 上后续 list IPC / multi-engine catalog fan-out
- **AND** MUST NOT dispatch A 的 `setThreads` from that request

#### Scenario: background engine refresh respects stale

- **WHEN** full-catalog 已调度 gemini/kimi/grok 后台 refresh 闭包
- **AND** 在闭包执行前或 await 后请求变为 stale
- **THEN** 闭包 MUST NOT dispatch `setThreads` for that stale request
- **AND** MUST 使用与主路径一致的 latest/stale 判定（不得只比对 requestSeq 而忽略 isStale）

#### Scenario: slot free still allows new workspace first-paint

- **WHEN** cancel 释放 active-workspace / thread-session-scan 槽位
- **AND** 新 active workspace 需要 first-paint
- **THEN** 系统 MUST 仍能立即启动新 workspace 的 list task（与 cold-start cancel 语义一致）

### Requirement: Runtime switch MUST NOT rely on startup gate for click safety

运行时跨 workspace 切换 MUST NOT 依赖 `StartupGateOverlay` 或 `startup-gate-ready` 来避免卡顿；可交互性 MUST 主要来自取消后停重活与既有 startTransition/yield 策略。

#### Scenario: post-gate switch still abandons stale work

- **WHEN** `startup-gate-ready` 已 stamp
- **AND** 用户从 workspace A 切到 B
- **THEN** A 的 in-flight list MUST 仍被 cancel 标记 stale 并协作式放弃
- **AND** 系统 MUST NOT 要求重新打开启动遮罩才能保持可点

### Requirement: Runtime workspace navigation MUST NOT use exhaustive session projection for owner topology

AppShell 在 workspace navigation 热路径中，仅为计算 Sidebar / Recent / Radar 的 owner workspace ids 时，MUST 从已加载 `workspaces` registry 本地推导 topology；MUST NOT 调用 `get_workspace_session_projection_summary`、`list_workspace_sessions(limit=9999)` 或等价 all-engine exhaustive scan。Session membership 仍由后续 bounded catalog hydration 决定，本地 topology 不得伪造 session rows。

#### Scenario: main workspace uses local direct-worktree scope

- **WHEN** active workspace 是 main workspace
- **AND** registry 包含该 main 的 direct worktrees、其他 main 或嵌套到别处的 worktrees
- **THEN** owner ids MUST 为 active main + 以 `parentId` 指向它的 direct child entries（正常形态为 worktrees，兼容 legacy missing-kind row）
- **AND** direct child entries MUST 按 path / name / id 确定性排序，与 backend `catalog_workspace_scope` 一致
- **AND** navigation render MUST NOT 因此启动 projection summary IPC

#### Scenario: active worktree remains isolated

- **WHEN** active workspace 是 worktree
- **THEN** owner ids MUST 只包含该 worktree
- **AND** parent main 与 sibling worktrees MUST NOT 混入

#### Scenario: workspace registry hydration race preserves active fallback

- **WHEN** `activeWorkspaceId` 已到达但 registry 尚未包含该 workspace
- **THEN** owner ids MUST 暂时保留 `[activeWorkspaceId]`
- **AND** MUST NOT 用 exhaustive projection IPC 补这个短暂 topology 缺口

#### Scenario: explicit Session Management may request aggregate counts

- **WHEN** 用户显式打开 Session Management 且 UI 需要 active/archive/folder counts 或 source statuses
- **THEN** 该 surface MAY 调用 projection summary
- **AND** 该能力 MUST NOT 被 AppShell workspace navigation 隐式挂载

### Requirement: Runtime workspace navigation MUST restore the last selected thread

侧栏点击或键盘 cycle 切到已访问过的 workspace 时，实现 MUST 恢复该 workspace 上次选中的 thread，MUST NOT 把 `activeThreadIdByWorkspace[target]` 写成 `null`。侧栏点击 MUST NOT 在点击帧调用 `ensureWorkspaceThreadListLoaded`；列表 hydrate 仍由 `activeWorkspaceId` 变化后的 quiet-gated first-paint / post-first-paint 路径负责。

热路径是 `WorkspaceCard` 行点击，不是只改 `handleSelectWorkspace` 函数体。非当前 workspace 的行点击 MUST 走 `onSelectWorkspace`（恢复 last thread）；只有已经 active 的行点击才 MAY 走 workspace home（显式新对话，允许写 `null`）。Archive / 新建 workspace / Home 按钮等显式清空路径不受本条款约束。

#### Scenario: sidebar click restores last thread without click-frame list hydrate

- **WHEN** 用户已在 workspace A 打开过 thread T
- **AND** 用户切到 workspace B 后再点回 A 的侧栏行（A 当时不是 active）
- **THEN** 系统 MUST 恢复 A 的 last thread T（必要时再次 `setActiveThreadId(T)` 以触发 evicted resume）
- **AND** MUST NOT `setActiveThreadId(null, A)`
- **AND** MUST NOT 把这次点击路由到 `handleOpenWorkspaceHome`
- **AND** 点击 handler MUST NOT 调用 `ensureWorkspaceThreadListLoaded(A)`

#### Scenario: active workspace row may open workspace home

- **WHEN** 用户点击当前已经 active 的 workspace 行
- **THEN** 实现 MAY 打开 workspace home / 新对话表面
- **AND** 该显式 home 路径 MAY `setActiveThreadId(null, activeWorkspaceId)`

#### Scenario: cycle prefers last thread over first listed row

- **WHEN** 用户用 cycle 切到 workspace B
- **AND** B 已记录 last thread T
- **THEN** 系统 MUST 恢复 T
- **AND** MUST NOT 用 sidebar 第一行覆盖 T
- **AND** MUST NOT `setActiveThreadId(null, B)`

#### Scenario: never-visited workspace may stay empty

- **WHEN** 目标 workspace 没有 last thread
- **AND** 导航来源是侧栏点击非 active 行
- **THEN** 系统 MUST 保持 thread map 不变（画布为空是正确态）
- **AND** 键盘 cycle MAY 回落到当前列表第一行，但仍 MUST NOT 写入 `null`
