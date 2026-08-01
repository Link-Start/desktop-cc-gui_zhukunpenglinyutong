# curated-skill-bundles Delta

## MODIFIED Requirements

### Requirement: Curated Skills MUST Appear In Settings

Settings > Skills MUST render only the `CuratedSection` as its skills surface; the legacy general skills management surface MUST NOT live in Settings (general skills management lives in Extensions → Skills, see `skills-hub-management`). The section MUST list bundled curated skills and expose Settings as the only on/off surface for curated skills. Each row SHOULD show icon, display name, description, token estimate, source/license affordances where available, and a toggle.

#### Scenario: default off

- **WHEN** the client starts with no enabled curated skill ids
- **THEN** curated skills MUST be listed in Settings
- **AND** their toggles MUST be off.

#### Scenario: toggle updates app settings

- **WHEN** the user turns on `Lazy senior dev`
- **THEN** the frontend MUST call `set_curated_skill_enabled`
- **AND** update local `useAppSettings` state from the returned `AppSettings`.

#### Scenario: unknown skill rejected

- **WHEN** `set_curated_skill_enabled` receives an empty or unknown skill id
- **THEN** it MUST return an error
- **AND** MUST NOT persist the id.

#### Scenario: legacy skills surface removed from Settings

- **WHEN** the user opens Settings > Skills
- **THEN** only the curated skills section MUST render
- **AND** general skill install/discovery management MUST be available in Extensions → Skills instead.
