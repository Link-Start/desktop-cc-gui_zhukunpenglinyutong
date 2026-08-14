# app-shell-runtime-boundaries delta — remove-kanban-and-task-center

## MODIFIED Requirements

### Requirement: AppShell Uses Typed Runtime Boundaries

AppShell SHALL assemble application sections and layout while delegating runtime, navigation, context, low-frequency feature activation behavior, and lane-specific render pressure to typed boundaries. Kanban mode and Task Center are not AppShell feature surfaces.

#### Scenario: AppShell wires runtime actions

- **WHEN** AppShell needs renderer/runtime lifecycle actions
- **THEN** those actions SHALL be exposed through a runtime action boundary
- **AND** AppShell SHALL pass typed callbacks rather than defining long inline runtime business handlers.

#### Scenario: AppShell wires feature activation boundaries

- **WHEN** AppShell needs inactive tabs, optional panels, detached windows, settings, SpecHub, Git History, search, or other non-first-screen surfaces
- **THEN** those surfaces SHOULD be reached through lazy feature activation boundaries
- **AND** AppShell MUST NOT directly import their heavy implementation modules unless a documented critical-shell invariant requires eager loading
- **AND** AppShell MUST NOT lazy-load or mount KanbanView or WorkspaceHome Task Center.

#### Scenario: AppShell keeps critical shell eager

- **WHEN** the app first renders
- **THEN** sidebar shell, active thread shell, composer basic input, and essential runtime notices SHALL remain available without waiting for low-frequency feature chunks
- **AND** feature-local suspense MUST NOT suspend the whole shell.

#### Scenario: five-zone ownership isolates canvas pressure

- **WHEN** the center conversation canvas receives high-frequency realtime updates
- **THEN** AppShell MUST keep top, left, right, and bottom interaction lanes behind narrow typed props or pressure signals
- **AND** AppShell MUST NOT pass full canvas render snapshots, message arrays, or canvas-only hydration state into those interaction lanes
- **AND** layout recomputation for interaction lanes MUST NOT be triggered solely by canvas-lane render churn

### Requirement: Refactor Preserves User-Facing Runtime Behavior

The architecture split SHALL preserve the previously accepted P0 runtime visibility behavior after Kanban and Task Center removal.

#### Scenario: HomeChat remains creation-first

- **WHEN** AppShell and thread runtime boundaries are refactored
- **THEN** HomeChat SHALL remain creation-first
- **AND** it SHALL NOT regain workspace-level run dashboard, Kanban, or Task Center entrypoints.

#### Scenario: contextual runtime surfaces remain available

- **WHEN** Conversation, Sidebar, Project Map, or Orchestration paths are exercised
- **THEN** existing contextual runtime indicators SHALL continue to work
- **AND** no TaskRun lifecycle truth source or linked-run banner SHALL be reintroduced.
