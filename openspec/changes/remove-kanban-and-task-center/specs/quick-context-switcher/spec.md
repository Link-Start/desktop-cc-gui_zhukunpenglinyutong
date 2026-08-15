# quick-context-switcher delta — remove-kanban-and-task-center

## MODIFIED Requirements

### Requirement: Recent-file activation MUST route the main panel to chat codex area

Quick Switcher file row activation MUST place the activated file in the visible main panel center area, regardless of the `appMode` / `activeTab` the user was on when opening Quick Switcher. The Quick Switcher caller MUST issue `setAppMode("chat")` and `setActiveTab("codex")` before delegating to the canonical `handleOpenFile` so that the `setCenterMode("editor")` step lands on the visible codex surface rather than being shadowed by the prior mode or tab. `AppMode` is `"chat" | "gitHistory" | "extensions"`; there is no `kanban` mode.

#### Scenario: Activate a recent file from a non-chat mode

- **WHEN** the user opens Quick Switcher while `appMode` is `gitHistory` or `extensions`
- **AND** activates a recent-file row
- **THEN** the Quick Switcher caller MUST call `setAppMode("chat")` before delegating to the canonical file-open action
- **AND** the center-area editor MUST render the selected file
- **AND** Quick Switcher MUST NOT offer a Kanban / Task Center destination

#### Scenario: Activate a recent file from a non-codex tab

- **WHEN** the user opens Quick Switcher while `activeTab` is `spec`, `git`, `log` or `projects`
- **AND** activates a recent-file row
- **THEN** the Quick Switcher caller MUST call `setActiveTab("codex")` before delegating to the canonical file-open action
- **AND** the main panel MUST land on the codex surface with the selected file visible

#### Scenario: Context flip precedes the canonical file-open delegation

- **WHEN** the Quick Switcher caller activates a recent-file row
- **THEN** the `setAppMode("chat")` and `setActiveTab("codex")` calls MUST be issued before `handleOpenFile`
- **AND** the canonical file-open contract (`handleOpenFile`) MUST remain the sole writer of file tab state, `centerMode`, and `editorSplitCompanion`
