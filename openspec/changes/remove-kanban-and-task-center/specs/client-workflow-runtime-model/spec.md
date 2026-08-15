# client-workflow-runtime-model delta — remove-kanban-and-task-center

## REMOVED Requirements

### Requirement: TaskRun Is The Client Execution Truth
**Reason**: Kanban 与 Task Center 整体移除（产品决策 2026-08-14）。`TaskRun` 不再是 client execution truth；`src/features/tasks/` 与 `MessagesLinkedRunBanner` 已删除。
**Migration**: 对话执行生命周期继续由 thread/runtime 投影表达。Orchestration / Project Map 不得再经 TaskRun 建第二套 run-status 真相源。存量 `taskCenter.taskRuns` 保留不动。

### Requirement: Run Detail Provides A Shared Explanation Surface
**Reason**: 共享 TaskRun detail surface 与 Task Center 内部路径一并退役。
**Migration**: 无替代 run-detail 产品面。Browser Evidence 仍挂在 browser-agent 会话上，不经 TaskRun。

### Requirement: Task Center Is Deferred While Run Detail Remains Shared
**Reason**: Task Center 不再是「延期隐藏」，而是功能面删除。
**Migration**: New Home / HomeChat 不提供 `View all runs` 或任何 Task Center 入口。

### Requirement: Context And Evidence Are Shown With Evidence Boundaries
**Reason**: 该条款绑定 TaskRun evidence / run detail。TaskRun 面删除后无宿主。
**Migration**: Browser Evidence 由 browser-agent 自有类型与面板展示；不经 TaskRun 证据字段。

## MODIFIED Requirements

### Requirement: Client Workflow Runtime Model Is An Integration Layer

The client workflow runtime model SHALL integrate existing conversation/thread runtime, Orchestration, runtime telemetry, and browser-agent evidence capabilities instead of introducing a parallel TaskRun or Task Center execution truth source.

#### Scenario: implementation needs run lifecycle truth

- **WHEN** New Home, Conversation, or Orchestration surfaces display execution lifecycle
- **THEN** they SHALL derive lifecycle state from existing thread/runtime projection helpers
- **AND** they SHALL NOT create a TaskRun store, Task Center surface, or second run-status enum.

#### Scenario: implementation needs card or detail display fields

- **WHEN** conversation or orchestration display fields are needed
- **THEN** the implementation SHALL extend or reuse the existing conversation/orchestration projection boundary
- **AND** it SHALL NOT recreate a TaskRun view-model or linked-run banner.

#### Scenario: older specs mention Workspace Home

- **WHEN** this change references the current home entry implementation
- **THEN** the implementation SHALL target `HomeChat` mounted through the layout home node via `showWorkspaceHome`
- **AND** older `Workspace Home` product terminology SHALL mean the HomeChat home-entry concept
- **AND** the deleted `WorkspaceHome` Task Center page SHALL NOT be reintroduced.

### Requirement: New Home Remains Creation-First

New Home SHALL remain a creation-first entry surface for choosing workspace context and starting conversation-first work. Kanban, Task Center, and workspace-level run dashboards SHALL stay absent.

#### Scenario: user opens New Home

- **WHEN** the user opens New Home
- **THEN** HomeChat SHALL keep workspace identity, engine identity, and the composer as the primary visible experience
- **AND** it SHALL NOT show a workspace-level run dashboard, run lanes, Kanban board, or Task Center.

#### Scenario: user opens New Home without run history

- **WHEN** the selected workspace has no recent conversations
- **THEN** New Home SHALL still present a complete creation-first workspace cockpit
- **AND** it SHALL NOT show a noisy empty dashboard skeleton.

#### Scenario: user reviews recent conversations

- **WHEN** recent conversations are available
- **THEN** New Home MAY show lightweight recent conversation shortcuts
- **AND** it SHALL NOT present TaskRun artifacts or Kanban cards as a Home dashboard.

#### Scenario: task module is removed

- **WHEN** the user looks for Task Center or Kanban entrypoints
- **THEN** New Home, Sidebar, Quick Switcher, and settings shortcuts SHALL NOT expose those surfaces
- **AND** Project Map SHALL NOT send users into a task-draft or Task Center module.

### Requirement: Runtime Visibility Is Contextual

Runtime visibility SHALL stay on contextual surfaces users actually revisit, such as session rows and conversation status, instead of duplicating a workspace dashboard or linked TaskRun banner on New Home.

#### Scenario: session row has live activity

- **WHEN** a session row has existing live processing or review activity state
- **THEN** the Sidebar MAY show a small status badge for that row
- **AND** the badge SHALL be derived from existing thread activity state rather than unlinked TaskRun state.

#### Scenario: active conversation has no Task Center link

- **WHEN** the active conversation is shown
- **THEN** Conversation SHALL NOT render a linked TaskRun / Task Center banner
- **AND** status-panel scroll (`AgentTaskScrollRequest`) MAY still locate in-conversation agent task cards.

#### Scenario: layout is compact

- **WHEN** the app is shown in a compact or narrow layout
- **THEN** New Home SHALL keep composer access prominent
- **AND** runtime status SHALL remain ambient or contextual rather than becoming a stacked Home dashboard.

### Requirement: Deprecated WorkspaceHome Is Not The P0 Entry Surface

The P0 client workflow integration SHALL target the current New Home implementation (`HomeChat` via `showWorkspaceHome`) and SHALL NOT restore the deleted `WorkspaceHome` Task Center page.

#### Scenario: planning or implementation chooses an entry component

- **WHEN** P0 work references the home entry surface
- **THEN** it SHALL target `HomeChat` mounted through layout home node
- **AND** it SHALL NOT add new behavior to a `WorkspaceHome` Task Center page.

### Requirement: AppShell Remains Wiring-Oriented For P0 Additions

P0 additions SHALL keep conversation, orchestration, and evidence business logic in feature-local hooks/utilities/components rather than expanding AppShell as a business controller.

#### Scenario: New Home needs derived data

- **WHEN** New Home needs workspace or recent-conversation data
- **THEN** the derivation SHOULD live in a feature-local selector, hook, or utility under home/workspace boundaries
- **AND** layout/AppShell SHOULD pass data and callbacks rather than owning TaskRun derivation.

#### Scenario: architecture note-card work is evaluated

- **WHEN** planning mentions splitting AppShell orchestration, splitting `useThreads` runtime, or removing core `@ts-nocheck`
- **THEN** those items SHALL be treated as follow-up architecture work outside current P0 acceptance
- **AND** they SHOULD be captured in a separate OpenSpec change rather than appended to the HomeChat visibility P0.
