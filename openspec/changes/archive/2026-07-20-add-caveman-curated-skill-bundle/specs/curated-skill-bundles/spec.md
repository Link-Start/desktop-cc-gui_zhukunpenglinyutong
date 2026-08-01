## MODIFIED Requirements

### Requirement: Client MUST Bundle Curated Skills As Versioned Assets

The desktop client MUST bundle curated skills as application resources under
`src-tauri/resources/curated-skills/<skill-id>/`. Each skill directory MUST
contain `SKILL.md` and `metadata.json`. The app MUST package those resources via
`tauri.conf.json` `bundle.resources` so curated skills are available offline and
are tied to the client release version. The client MUST NOT fetch curated skill
bodies from a remote marketplace or URL at runtime.

The default bundled curated entries are `lazy-senior-dev` (Ponytail coding
minimization policy) and `caveman` (Caveman concise communication policy).
`caveman` is one user-facing switch: its review, commit-message, and help
response patterns are aggregated into the single `caveman` body rather than
exposed as separate toggles.

`tauri.conf.json` MUST preserve each `<skill-id>/` directory when packaging
curated skills. The preferred mapping is the directory mapping
`"resources/curated-skills": "curated-skills"`; explicit per-skill directory
mappings such as
`"resources/curated-skills/<skill-id>": "curated-skills/<skill-id>"` are also
valid. The app MUST NOT use the map-style glob
`"resources/curated-skills/**/*": "curated-skills/"`, because Tauri flattens
that glob and packaged clients lose the `<skill-id>/SKILL.md` and
`<skill-id>/metadata.json` layout.

#### Scenario: caveman bundled as one aggregated entry

- **WHEN** the client is built
- **THEN** the app resources MUST include `curated-skills/caveman/`
- **AND** that directory MUST contain `SKILL.md` and `metadata.json`
- **AND** `skills-lock.json` MUST contain exactly one curated entry named
  `caveman` for the Caveman family
- **AND** separate `caveman-review`, `caveman-commit`, and `caveman-help`
  curated entries MUST NOT be required for bundled core behavior.

### Requirement: AppSettings MUST Persist Enabled Curated Skill IDs

`AppSettings` MUST include `enabled_curated_skill_ids: Vec<String>`, serialized
to the frontend as `enabledCuratedSkillIds`, plus a versioned curated-default
migration marker. New and reset defaults MUST contain `lazy-senior-dev` and
`caveman`. A legacy non-empty curated list that predates Caveman MUST add it
once during settings restore; after the marker advances, a user removing
`caveman` MUST remain opted out on later restarts. An explicitly persisted
empty array MUST remain empty to preserve a user opt-out. The setting MUST persist through the normal
settings core and MUST be shared across workspaces for the same client install.
Settings normalization MUST trim, de-duplicate, and drop empty or non
kebab-case ASCII ids before persisting/restoring the field.

Curated skill id changes MUST participate in Codex restart detection. macOS/Linux launch paths MUST preserve the existing app-server `developer_instructions` transport, while every supported platform MUST also send the latest authoritative snapshot at Codex turn start. Restart alone MUST NOT be treated as replacing developer state already associated with a resumed thread.

Windows launch paths MUST avoid injecting ccgui-generated curated skill bodies through process argv when preserving them through argv would block startup. This MUST NOT mutate `enabledCuratedSkillIds`; the skill remains enabled and MUST be made available to Codex turns through JSON-RPC settings.

Windows Claude launch paths MUST avoid injecting ccgui-generated curated skill bodies through process argv and MUST make enabled curated skills available through Claude native skill discovery. The native mirror path MUST be resolved from the effective Claude home rather than a hard-coded OS path.

Windows Claude launch paths MUST activate enabled curated skills through a ccgui-managed short prompt file passed with `--append-system-prompt-file`. The activation hint MUST name enabled skill ids and tell Claude to invoke matching native Skills for suitable turns. It MUST NOT contain full curated skill bodies.

#### Scenario: missing field uses built-in defaults

- **WHEN** an existing config file does not contain `enabledCuratedSkillIds`
- **THEN** restore MUST succeed
- **AND** a new or reset settings object MUST contain `lazy-senior-dev` and
  `caveman`.

#### Scenario: explicit empty list remains an opt-out

- **WHEN** a config file explicitly contains `"enabledCuratedSkillIds": []`
- **THEN** restore MUST preserve an empty array
- **AND** the client MUST NOT silently re-add either default curated skill.

#### Scenario: legacy non-empty curated list enables Caveman once

- **WHEN** an existing config contains `["lazy-senior-dev"]` and predates the
  current curated-default migration marker
- **THEN** restore MUST add `caveman` and advance the marker
- **AND** removing `caveman` after migration MUST remain effective after restart
- **AND** a legacy explicit empty list MUST remain empty.

#### Scenario: Caveman is toggled as one family

- **WHEN** the user toggles `Caveman` in Settings
- **THEN** only the `caveman` id MUST be added to or removed from
  `enabledCuratedSkillIds`
- **AND** the review, commit-message, and help response patterns MUST follow
  that same id
- **AND** no child Caveman id (`caveman-review`, `caveman-commit`,
  `caveman-help`) MUST be persisted.

#### Scenario: current Codex thread receives an authoritative disabled snapshot

- **WHEN** a bundled curated skill was injected into an existing Codex thread
- **AND** the user later disables that skill while continuing the same thread
- **THEN** the next generated developer instructions MUST identify the current
  ccgui bundled curated skill set as authoritative
- **AND** any earlier bundled curated skill whose id is absent from the current
  snapshot MUST be declared inactive
- **AND** an empty enabled set MUST emit an explicit `Enabled: none` state rather
  than omitting the curated section
- **AND** this state MUST NOT revoke user-supplied developer instructions,
  system instructions, or skills exposed through other mechanisms.

#### Scenario: re-enabled skills reach a resumed Codex thread on every platform

- **WHEN** the user disables and then re-enables one or more bundled curated skills
- **AND** Codex continues the same persisted thread after a runtime restart
- **THEN** the next `turn/start` on macOS, Linux, and Windows MUST carry the latest
  authoritative snapshot through `collaborationMode.settings.developer_instructions`
- **AND** the snapshot MUST contain every currently enabled bundled skill body
- **AND** macOS/Linux MUST retain their existing launch-time injection
- **AND** Windows MUST continue omitting generated curated bodies from process argv.

## ADDED Requirements

### Requirement: Caveman Core MUST Use One Aggregated Control

The bundled `caveman` skill MUST aggregate the upstream Caveman communication
rules, intensity guidance (lite / full / ultra), wenyan guidance
(wenyan-lite / wenyan-full / wenyan-ultra), auto-clarity boundaries, review
response format, commit-message response format, and help / capability
boundaries into one `SKILL.md`. The Settings UI MUST expose only the `caveman`
switch for this family. The aggregated body MUST preserve exact code, commands,
paths, URLs, identifiers, and error strings; MUST forbid invented prose
abbreviations (`cfg`, `impl`, `req`, `res`, `fn` outside Rust code) and arrow
substitutions (`A → B`); and MUST restore complete, unambiguous prose for
security warnings, irreversible actions, ambiguous multi-step sequences, and
user confusion / correction signals.

The upstream `caveman-compress`, `caveman-stats`, `cavecrew`, `caveman-shrink`,
and `caveman-init` features require file mutation, session-log hooks,
subagent orchestration, MCP middleware, or repository rule installation that
the client does not currently provide. Until matching runtime APIs exist, the
bundled `caveman` body MUST identify these features as unavailable and MUST NOT
claim to have executed them.

The Settings row MUST localize the Caveman description for the active UI locale
while preserving `metadata.json.description` as the fallback for missing
translations. Simplified Chinese MUST display a Chinese description; English
MUST continue to display an English description.

#### Scenario: one Caveman switch controls aggregated behavior

- **WHEN** `enabledCuratedSkillIds` contains `caveman`
- **THEN** communication rules, intensity guidance, review output format,
  commit-message output format, and help / capability boundaries MUST be
  injected from the same `<skill id="caveman">` body
- **AND** no `caveman-review`, `caveman-commit`, or `caveman-help` id MUST be
  required or persisted.

#### Scenario: runtime-only capability is not fabricated

- **WHEN** the user asks for token statistics, session-log compression,
  Caveman-aware subagent orchestration, MCP description shrinking, or
  repository-wide Caveman initialization
- **THEN** the client MUST NOT claim that the operation ran unless the
  corresponding runtime integration is present
- **AND** the assistant MUST state the capability boundary clearly.

#### Scenario: Caveman safety boundary restores clarity

- **WHEN** a response contains a security warning, irreversible action,
  ambiguous multi-step sequence, or the user asks for clarification
- **THEN** the Caveman rules MUST use complete, unambiguous prose for that
  part
- **AND** MUST retain required validation, error handling, accessibility, and
  recovery information.

#### Scenario: Caveman commit message skill never auto-executes git commit

- **WHEN** the assistant generates a Caveman commit message
- **THEN** the output MUST be a ready-to-use commit message text
- **AND** the assistant MUST NOT execute `git commit`, `git commit -m`, or any
  other commit-creating command on the user's behalf.

#### Scenario: Caveman description follows the UI locale

- **WHEN** Settings renders the Caveman row in Simplified Chinese
- **THEN** the description MUST be Chinese
- **AND** switching to English MUST use the English description
- **AND** a missing translation MUST fall back to the bundled metadata text.
