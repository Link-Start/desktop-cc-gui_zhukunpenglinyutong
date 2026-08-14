# client-startup-orchestration delta — remove-dictation-feature

## MODIFIED Requirements

### Requirement: Client startup SHALL use phase-based orchestration

The client SHALL route startup-time loading through a frontend Startup Orchestrator that assigns each task to exactly one startup phase: `critical`, `first-paint`, `active-workspace`, `idle-prewarm`, or `on-demand`.

#### Scenario: first paint is not blocked by heavy hydration

- **WHEN** the application opens the main client window
- **THEN** `critical` and `first-paint` tasks SHALL be the only phases allowed to block initial shell rendering
- **AND** thread/session full hydration, complete file tree loading, git diff preload, and catalog prewarm SHALL NOT block the initial shell render

#### Scenario: task declares orchestration metadata

- **WHEN** a startup-time load is registered with the Startup Orchestrator
- **THEN** the task SHALL declare `id`, `phase`, `priority`, `dedupeKey`, `concurrencyKey`, `timeoutMs`, `workspaceScope`, `cancelPolicy`, `traceLabel`, and fallback behavior
- **AND** the orchestrator SHALL reject or flag startup tasks that lack required metadata

#### Scenario: startup phases preserve active workspace priority

- **WHEN** the app has an active workspace during startup
- **THEN** active workspace minimal hydration SHALL run before idle prewarm for non-active workspaces
- **AND** non-active workspace scans SHALL wait for an idle slot or explicit user interaction

### Requirement: Startup orchestration SHALL separate critical loading from opportunistic prewarm

The client SHALL keep the critical startup path limited to data needed to render and operate the initial shell, while opportunistic preloads SHALL run only after first paint, during idle time, or after explicit user demand.

#### Scenario: catalog prewarm runs after shell interactivity

- **WHEN** skills, prompts, commands, collaboration modes, agents, engine model catalog, or non-active session catalogs are loaded opportunistically
- **THEN** those tasks SHALL run after the shell is interactive
- **AND** they SHALL not block active workspace minimal hydration
