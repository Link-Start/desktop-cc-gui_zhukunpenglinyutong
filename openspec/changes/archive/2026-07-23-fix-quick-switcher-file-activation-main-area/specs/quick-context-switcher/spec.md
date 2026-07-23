## ADDED Requirements

### Requirement: Recent-file activation MUST route the main panel to chat codex area

Quick Switcher file row activation MUST place the activated file in the visible main panel center area, regardless of the `appMode` / `activeTab` the user was on when opening Quick Switcher. The Quick Switcher caller MUST issue `setAppMode("chat")` and `setActiveTab("codex")` before delegating to the canonical `handleOpenFile` so that the `setCenterMode("editor")` step lands on the visible codex surface rather than being shadowed by the prior mode or tab.

#### Scenario: Activate a recent file from a non-chat mode

- **WHEN** the user opens Quick Switcher while `appMode` is `kanban` or `gitHistory`
- **AND** activates a recent-file row
- **THEN** the Quick Switcher caller MUST call `setAppMode("chat")` before delegating to the canonical file-open action
- **AND** the center-area editor MUST render the selected file

#### Scenario: Activate a recent file from a non-codex tab

- **WHEN** the user opens Quick Switcher while `activeTab` is `spec`, `git`, `log` or `projects`
- **AND** activates a recent-file row
- **THEN** the Quick Switcher caller MUST call `setActiveTab("codex")` before delegating to the canonical file-open action
- **AND** the main panel MUST land on the codex surface with the selected file visible

#### Scenario: Context flip precedes the canonical file-open delegation

- **WHEN** the Quick Switcher caller activates a recent-file row
- **THEN** the `setAppMode("chat")` and `setActiveTab("codex")` calls MUST be issued before `handleOpenFile`
- **AND** the canonical file-open contract (`handleOpenFile`) MUST remain the sole writer of file tab state, `centerMode`, and `editorSplitCompanion`

### Requirement: Recent-file activation MUST close the home surface before delegating to the file-open action

When the user activates a Quick Switcher file row, the Quick Switcher caller MUST hide both the global home surface (`setHomeOpen(false)`) and the workspace home state (`setWorkspaceHomeWorkspaceId(null)`) before delegating to `handleOpenFile`. The bootstrap shell state — `activeWorkspace === null` and the persisted recent-file MRU — MUST still produce a visible file editor in the main panel center area, because file tab writes alone are masked by the homeNode until those two home-state setters take effect.

#### Scenario: Activate a recent file from the bootstrap shell state

- **WHEN** the user activates a Quick Switcher file row while the AppShell has not yet selected an active workspace
- **AND** the selected file belongs to a workspace persisted in the recent-file MRU
- **THEN** the Quick Switcher caller MUST call `setHomeOpen(false)` and `setWorkspaceHomeWorkspaceId(null)` before delegating to `handleOpenFile`
- **AND** the center-area MUST render the selected file editor instead of the home welcome surface

#### Scenario: Home-state setters precede the canonical file-open delegation

- **WHEN** the Quick Switcher caller activates a recent-file row
- **THEN** the `setHomeOpen(false)` and `setWorkspaceHomeWorkspaceId(null)` calls MUST be issued strictly before `handleOpenFile`
- **AND** those setters MUST use the existing canonical `setHomeOpen` / `setWorkspaceHomeWorkspaceId` contract used by `handleSelectThread`
