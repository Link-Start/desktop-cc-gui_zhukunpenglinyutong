# startup-css-loading-performance delta — remove-kanban-and-task-center

## MODIFIED Requirements

### Requirement: Startup CSS MUST Be Limited To First-Screen Critical Styling

renderer bootstrap path MUST 只加载 initial shell 与 immediately visible controls 所需 CSS；feature-only styles MUST defer 到 feature activation path。Kanban 与 WorkspaceHome Task Center 不再是可激活 feature surface，其 CSS 不得回到 bootstrap。

#### Scenario: bootstrap CSS has explicit first-screen ownership

- **WHEN** CSS file is imported by `src/bootstrap.ts`
- **THEN** stylesheet MUST be classified as critical or first-visible-shell styling
- **AND** classification MUST cover app shell, sidebar shell, main layout, minimal messages, minimal composer, or shared primitive styling
- **AND** feature-only surfaces not visible on first render MUST NOT be imported directly by bootstrap
- **AND** deleted Kanban / WorkspaceHome styles MUST NOT re-enter bootstrap or eager shell CSS

#### Scenario: feature CSS loads on feature activation

- **WHEN** user first opens file preview, diff view, settings, SpecHub, Git History, browser agent, search palette, or intent canvas
- **THEN** feature-specific CSS required for that surface MUST be loaded by the feature activation path or lazy feature entry
- **AND** app shell MUST remain usable while that CSS loads
- **AND** there SHALL be no Kanban or WorkspaceHome Task Center activation path that loads dedicated CSS
