# skills-hub-management Delta

## ADDED Requirements

### Requirement: Skills Management MUST Use A Built-In Rust Skills Hub Backend

The desktop app MUST provide skills management through a built-in Rust backend (`src-tauri/src/skills_hub.rs`) exposed as two Tauri commands, `skills_hub_query` and `skills_hub_mutate`. The backend MUST be fully self-contained and MUST NOT require the `tokentracker` CLI to be installed. Response and error shapes MUST stay 1:1 with the upstream skills-manager HTTP endpoint so the vendored skills frontend works unmodified.

#### Scenario: skills data loads without tokentracker CLI

- **WHEN** the user opens Extensions → Skills and `tokentracker` CLI is not installed
- **THEN** the skills dashboard MUST still load installed skills via `skills_hub_query`
- **AND** no CLI installation gate MUST be shown.

#### Scenario: upstream HTTP semantics preserved

- **WHEN** the vendored skills frontend passes a `force` flag or pagination params
- **THEN** the frontend transport MUST serialize `force` as a string (matching upstream HTTP semantics)
- **AND** `offset`/`limit` MUST remain numbers when invoking `skills_hub_query`.

### Requirement: Extensions Skills Tab MUST Render The Vendored Skills Dashboard

Extensions → Skills MUST render the vendored skills dashboard (`pages/SkillsPage.jsx` with `SkillDetailPanel`) covering My Skills (installed list, target-engine chips, bulk select, uninstall, restore), discovery (popular / skillssh / search), install / import-local, update checks, and a per-skill detail panel. The vendored page and its dependencies (`motion`, `@base-ui`) MUST be isolated in a `React.lazy` async chunk and MUST NOT enter the startup bundle.

#### Scenario: user opens the Skills tab

- **WHEN** the user activates Extensions → Skills
- **THEN** the app MUST lazy-load the vendored skills dashboard
- **AND** bridge app locale/theme into the vendored view
- **AND** the startup bundle MUST NOT include `motion` or `@base-ui`.

#### Scenario: browser dev preview fallback

- **WHEN** the vendored dashboard runs outside the Tauri runtime (browser dev preview)
- **THEN** `lib/skills-api.ts` MUST fall back to the `/tt-dev` proxy transport against a locally running `tokentracker serve`.

### Requirement: Large Skill Libraries MUST Stay Responsive

When the installed skill list exceeds the virtualization threshold (80 rows), My Skills MUST render only the visible row window computed from the extensions scroll container (fixed row height 88px, overscan 8) instead of mounting every row. Bulk actions MUST remain sticky below the extension tab row while skills are selected, and the bulk remove action MUST use explicit destructive styling.

#### Scenario: large library scrolls smoothly

- **WHEN** the installed skill library has more than 80 rows and the user scrolls
- **THEN** only the visible window plus overscan rows MUST be mounted
- **AND** the list MUST keep a fixed-height container so scroll position stays stable.

#### Scenario: bulk actions remain reachable

- **WHEN** the user selects skills and scrolls the list
- **THEN** the bulk action bar MUST stay sticky below the extension tab row
- **AND** the bulk remove action MUST be rendered with destructive styling.
