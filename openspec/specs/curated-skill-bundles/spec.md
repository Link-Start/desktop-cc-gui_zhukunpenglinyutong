# curated-skill-bundles Specification

## Purpose

`curated-skill-bundles` defines the client-bundled curated skill system:
version-pinned skill assets ship with the desktop app, users enable them from
Settings, and enabled skill bodies are injected into supported engine launches.
Composer UI is read-only feedback only; Settings remains the only toggle
surface.
## Requirements
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

#### Scenario: lazy-senior-dev bundled

- **WHEN** the client is built
- **THEN** the app resources MUST include `curated-skills/lazy-senior-dev/`
- **AND** that directory MUST contain `SKILL.md` and `metadata.json`
- **AND** `metadata.json` MUST declare `name`, `displayName`, `version`,
  `description`, `icon`, `category`, `tokenEstimate`, `source`, `sourceUrl`,
  and `license`.

#### Scenario: caveman bundled as one aggregated entry

- **WHEN** the client is built
- **THEN** the app resources MUST include `curated-skills/caveman/`
- **AND** that directory MUST contain `SKILL.md` and `metadata.json`
- **AND** `skills-lock.json` MUST contain exactly one curated entry named
  `caveman` for the Caveman family
- **AND** separate `caveman-review`, `caveman-commit`, and `caveman-help`
  curated entries MUST NOT be required for bundled core behavior.

#### Scenario: packaged resources preserve skill directory layout

- **WHEN** `tauri build` packages curated skills
- **THEN** `Contents/Resources/curated-skills/lazy-senior-dev/SKILL.md` and
  `Contents/Resources/curated-skills/lazy-senior-dev/metadata.json` MUST exist
  on macOS packages
- **AND** the build MUST fail if `tauri.conf.json` maps
  `resources/curated-skills/**/*` to `curated-skills/`.

#### Scenario: runtime loader resolves packaged and source layouts

- **WHEN** the client enumerates curated skills in a packaged app
- **THEN** the loader MUST resolve `skills-lock.json` from the application
  resource directory when present
- **AND** repo-style lock paths such as
  `resources/curated-skills/<skill-id>/SKILL.md` MUST resolve to packaged paths
  under `curated-skills/<skill-id>/`
- **AND** development/test runs MAY fall back to the source tree layout under
  `src-tauri/resources/curated-skills/<skill-id>/`.

#### Scenario: no network fetch at startup

- **WHEN** the client enumerates curated skills
- **THEN** it MUST read bundled local resources
- **AND** MUST NOT issue outbound HTTP/HTTPS requests for curated skill
  discovery or content.

### Requirement: Curated Skill Lock Entries MUST Be Validated At Compile Time

The build-time lock validator and runtime curated-skill loader MUST validate
`skills-lock.json` without relying on OS-specific shell commands or path
semantics. SHA-256 hash validation MUST use a Rust implementation that works on
Linux, macOS, and Windows. Curated `SKILL.md` assets MUST be checked out with
LF line endings so `computedHash` is stable across Windows, macOS, and Linux.
`assetPath` and `metadataPath` MUST be non-empty
repo-relative POSIX paths: absolute paths, parent directory traversal, Windows
backslash separators, and drive-prefix-like `:` values MUST be rejected before
any file read is attempted. Cargo MUST watch the repo-root `skills-lock.json`
path for rebuilds, not a stale package-local path.

#### Scenario: build validator works on Windows/macOS/Linux

- **WHEN** `cargo test` or `cargo build` runs on Windows, macOS, or Linux
- **THEN** `build.rs` MUST compute `computedHash` with Rust code
- **AND** it MUST NOT spawn `sha256sum`, `shasum`, shell, cmd.exe, or any
  other external hash utility.

#### Scenario: unsafe lock path is rejected

- **GIVEN** a curated lock entry whose `assetPath` is `../escape/SKILL.md`,
  `/tmp/SKILL.md`, `C:/tmp/SKILL.md`, or `resources\\skill\\SKILL.md`
- **WHEN** the build validator or runtime loader processes the lock
- **THEN** it MUST reject the entry with an actionable error
- **AND** it MUST NOT read outside the curated resource tree.

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

#### Scenario: toggle persists

- **WHEN** the user enables `lazy-senior-dev`
- **THEN** `enabledCuratedSkillIds` MUST include `lazy-senior-dev`
- **AND** the value MUST be restored after app restart.

#### Scenario: Settings toggle reflects authoritative result immediately

- **WHEN** the user toggles `lazy-senior-dev` in Settings `MCP / Skills`
- **AND** `set_curated_skill_enabled` returns an updated `AppSettings`
- **THEN** the visible switch MUST update from that returned `enabledCuratedSkillIds` in the current Settings view
- **AND** the user MUST NOT need to switch to another module and back to see the new state.

#### Scenario: Settings toggle failure preserves previous visible state

- **WHEN** the user toggles `lazy-senior-dev` in Settings `MCP / Skills`
- **AND** `set_curated_skill_enabled` fails
- **THEN** the visible switch MUST remain on the previous `enabledCuratedSkillIds` state
- **AND** Settings MUST surface the error instead of displaying a false successful toggle.

#### Scenario: curated toggle requires Codex restart

- **WHEN** `enabledCuratedSkillIds` changes
- **THEN** `app_settings_change_requires_codex_restart` MUST return true
- **AND** the next healthy Codex app-server launch MUST use the updated curated skill set.

#### Scenario: Windows launch keeps setting enabled and avoids startup argv

- **WHEN** `lazy-senior-dev` is enabled
- **AND** Windows Codex app-server launch starts without ccgui-generated curated skill argv
- **THEN** `enabledCuratedSkillIds` MUST remain unchanged
- **AND** the next Codex turn MUST include the enabled curated skill body through `turn/start.collaborationMode.settings.developer_instructions`
- **AND** macOS and Linux launch paths MUST continue injecting enabled curated skills through launch-time `developer_instructions` when no user override exists.

### Requirement: Curated Skills MUST Appear In Settings

Settings > Skills MUST render a `CuratedSection` above the regular skills
surface. The section MUST list bundled curated skills and expose Settings as the
only on/off surface. Each row SHOULD show icon, display name, description,
token estimate, source/license affordances where available, and a toggle.

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

### Requirement: Composer MUST Show A Read-Only Curated Skill Indicator

The composer MUST NOT provide per-message curated skill toggles, chip rows, or
pickers. When at least one curated skill is enabled, composer UI MUST render a
read-only `CuratedSkillIndicator` as a right-side accessory in
`ComposerReadinessBar` via the prop chain
`ChatInputBox -> ChatInputBoxHeader.rightAccessory ->
ComposerReadinessBar.rightAccessory`.

The indicator MUST render inside `.composer-readiness-right-accessory`, MUST use
ChatInputBox-bundled CSS for cold-start correctness, and MUST not toggle skills
directly. If clickable, it MAY navigate to Settings > Skills.

#### Scenario: hidden when none enabled

- **WHEN** no curated skills are enabled
- **THEN** the indicator MUST render nothing
- **AND** MUST leave no visible empty accessory.

#### Scenario: visible in readiness bar accessory

- **WHEN** `lazy-senior-dev` is enabled
- **THEN** `[data-testid="curated-indicator"]` MUST render inside
  `.composer-readiness-right-accessory`
- **AND** MUST NOT render as a separate input/footer chip row.

#### Scenario: Settings change reflected

- **WHEN** Settings toggles a curated skill on or off
- **THEN** the indicator MUST reflect the enabled set within its polling cadence
  without requiring a renderer reload.

### Requirement: Codex Engine MUST Append Curated Skill Bodies As Developer Instructions

Codex app-server launch MUST make enabled curated skill bodies available as
merged `developer_instructions` when curated skills are enabled and the user has
not supplied an instruction override. For primary launches, this MAY continue to
use a `-c developer_instructions=...` argv config value. For Windows `.cmd/.bat`
wrapper compatibility retry, the engine MUST avoid sending generated curated
skill bodies through argv and MUST instead project them into a ccgui-generated
Codex profile file under the effective `CODEX_HOME`.

The merge MUST preserve existing internal developer instructions and append a
`## Curated Skills` section containing `<skill id="...">...</skill>` blocks.

#### Scenario: empty enabled set produces no curated arg

- **WHEN** no curated skills are enabled
- **THEN** Codex args MUST not add a curated `developer_instructions` block.

#### Scenario: enabled skill is injected on primary launch

- **WHEN** `enabledCuratedSkillIds` contains `lazy-senior-dev`
- **AND** Codex app-server launch is the primary launch path
- **THEN** Codex launch args MUST include generated `developer_instructions`
  containing `<skill id="lazy-senior-dev">`.

#### Scenario: wrapper compatibility retry uses generated profile

- **WHEN** `enabledCuratedSkillIds` contains `lazy-senior-dev`
- **AND** Windows wrapper compatibility retry builds Codex app-server launch
- **THEN** retry argv MUST NOT include generated `developer_instructions`
  containing `<skill id="lazy-senior-dev">`
- **AND** a ccgui-owned generated profile under the effective `CODEX_HOME` MUST
  contain generated `developer_instructions` containing
  `<skill id="lazy-senior-dev">`
- **AND** the retry args MUST still include user-authored Codex args such as
  `--profile` or `--sandbox` when those args are valid.

#### Scenario: user override wins

- **WHEN** user-supplied Codex args already include `developer_instructions=` or
  `instructions=`
- **THEN** curated injection MUST NOT overwrite the user override
- **AND** wrapper compatibility retry MUST NOT create a competing generated
  curated-skill profile for that launch.

### Requirement: Claude Engine MUST Append Curated Skill Bodies As System Prompt

Claude launch construction MUST append enabled curated skill bodies through the
Claude CLI `--append-system-prompt <body>` flag. User prompt bytes MUST continue
to use the existing stdin / stream-json path.

#### Scenario: empty enabled set produces no flag

- **WHEN** no curated skills are enabled
- **THEN** Claude launch args MUST NOT include `--append-system-prompt` for
  curated skills.

#### Scenario: enabled skill is injected

- **WHEN** `enabledCuratedSkillIds` contains `lazy-senior-dev`
- **THEN** Claude launch args MUST include `--append-system-prompt`
- **AND** the following argument MUST contain the `## Curated Skills` section and
  `<skill id="lazy-senior-dev">` block.

#### Scenario: oversized body is bounded

- **WHEN** the combined curated skill prompt body exceeds the implementation
  budget
- **THEN** it MUST be truncated safely
- **AND** the body MUST include a `claude-injection-truncated: true` marker.

### Requirement: Skills List Paths MUST Expose Curated Skill Enabled State

The Tauri command path and daemon path MUST expose curated skill entries with
`source: "curated_bundled"` and an `enabled` boolean computed from
`AppSettings.enabled_curated_skill_ids`. Non-curated skill entries MUST keep
their existing behavior and default enabled state.

#### Scenario: enabled curated entry is true

- **WHEN** `enabledCuratedSkillIds` contains `lazy-senior-dev`
- **THEN** the `lazy-senior-dev` curated skill list entry MUST have
  `enabled: true`.

#### Scenario: disabled curated entry is false

- **WHEN** `enabledCuratedSkillIds` is empty
- **THEN** the `lazy-senior-dev` curated skill list entry MUST have
  `enabled: false`.

### Requirement: Adding A New Curated Skill MUST Follow The Onboarding Checklist

New curated skill entries MUST follow `docs/curated-skill-onboarding.md` and the
archived onboarding checklist. Required checks include attribution, metadata
schema, SHA-256 lock consistency, approved license, icon format, category,
token estimate, naming collision avoidance, and a "When NOT to enable" section.

#### Scenario: invalid addition is rejected

- **WHEN** a curated skill addition violates the build-time validator rules
- **THEN** `cargo check` MUST fail before release packaging.

### Requirement: Rollback Paths MUST Be Documented

The curated skill onboarding documentation MUST document compile-time, asset,
and runtime rollback paths for emergency response.

#### Scenario: runtime soft-disable path exists

- **WHEN** curated skill activation needs to be disabled quickly
- **THEN** maintainers MUST have a documented path to keep UI/config schema
  compatible while preventing new enabled curated skill ids from taking effect.

### Requirement: Composer Shows A Read-Only Always-On Indicator In The Readiness Bar

The desktop client MUST render a read-only **always-on indicator** in the
composer readiness bar whenever at least one curated skill is enabled. The
indicator MUST be supplied by `ChatInputBox` through the generic
`ChatInputBoxHeader.rightAccessory -> ComposerReadinessBar.rightAccessory`
prop chain and MUST render inside `.composer-readiness-right-accessory`.
`ComposerReadinessBar` MUST NOT directly import the curated-skills domain.

The indicator MUST be hidden (zero visual weight) when zero curated skills are
enabled. For each enabled skill, the indicator MUST show the skill's lucide
icon and display name in a single-line chip. Long names MUST truncate instead
of wrapping, and additional enabled skills MAY collapse into a compact `+N`
overflow chip. The indicator MUST reflect the live
`AppSettings.enabledCuratedSkillIds` set within a polling cadence of 2 seconds
so toggling a skill on or off in Settings is visible to the user in the
composer without an app restart. The indicator MUST NOT provide an on/off
affordance; Settings > Skills > Curated remains the only toggle surface.

The `.composer-readiness-right-accessory` and `.curated-indicator*` CSS MUST
ship in the ChatInputBox style bundle so cold composer startup uses the same
single-line layout as the post-Settings return path.

#### Scenario: indicator hidden when no skills are enabled

- **GIVEN** `AppSettings.enabledCuratedSkillIds` is empty
- **WHEN** the user opens the composer
- **THEN** the composer MUST NOT contain any element matching
  `.curated-indicator`.

#### Scenario: indicator visible in readiness bar accessory

- **GIVEN** `AppSettings.enabledCuratedSkillIds` contains
  `lazy-senior-dev`
- **WHEN** the user opens the composer
- **THEN** a `[data-testid="curated-indicator"]` element MUST be rendered
- **AND** the element MUST be a descendant of
  `.composer-readiness-right-accessory`
- **AND** the element MUST NOT be rendered in a
  `home-chat-curated-skill-strip` input/footer strip.

#### Scenario: indicator chip stays single-line on cold start

- **GIVEN** the user has not opened Settings in the current renderer session
- **AND** `AppSettings.enabledCuratedSkillIds` contains `lazy-senior-dev`
- **WHEN** the composer first renders the indicator
- **THEN** the chip MUST show the lucide icon and display name on one line
- **AND** long display names MUST truncate with ellipsis instead of wrapping.

#### Scenario: Settings toggle change is reflected within 2 seconds

- **GIVEN** the composer is open and the indicator is visible
- **WHEN** the user toggles a new curated skill on in `Settings > Skills`
- **THEN** within 2 seconds the indicator MUST add a chip for the newly enabled
  skill
- **AND** within 2 seconds of toggling it off, the indicator MUST remove the
  chip.

#### Scenario: readiness bar core controls remain usable

- **GIVEN** one or more curated skills are enabled
- **WHEN** the readiness bar renders the right accessory
- **THEN** mode, target, context summary, jump-to-request, and context-source
  expand controls MUST remain visible or gracefully truncated according to the
  existing readiness bar responsive rules
- **AND** the indicator MUST truncate itself before overlapping those controls.

### Requirement: Curated Skill Activation Is Always-On Per User

The engine MUST treat the set of curated skill ids in
`AppSettings.enabledCuratedSkillIds` as **always-on for every
conversation**: when an id is present, the engine MUST inject that
skill's `SKILL.md` body into the conversation's system prompt for
**every** subsequent message in **every** workspace, with no further
user action. The injection MUST be applied identically to fresh
sessions and resumed sessions. There is no per-conversation, per-turn,
or per-message opt-in / opt-out path for curated skills in this
change. Toggling a skill off (removing it from
`enabledCuratedSkillIds`) MUST cause the engine to stop injecting it
on the next conversation; the change is observed on the next CLI
launch, not retroactively on in-flight turns.

#### Scenario: enabled skill appears in every conversation's system prompt

- **GIVEN** `AppSettings.enabledCuratedSkillIds` contains
  `lazy-senior-dev`
- **WHEN** the user starts a new conversation in any workspace
- **THEN** the engine's `--append-system-prompt` (or equivalent
  system-prompt assembly path) MUST include a `<skill id="lazy-senior-dev">…</skill>`
  block sourced from the bundled `SKILL.md`
- **AND** the block MUST be present on the first turn and on every
  subsequent turn in the same session.

#### Scenario: Codex internal developer instructions do not suppress curated skills

- **GIVEN** `AppSettings.enabledCuratedSkillIds` contains
  `lazy-senior-dev`
- **AND** the Codex app-server launch path also needs to inject an
  internal `developer_instructions` hint
- **WHEN** the desktop client builds the Codex `app-server` argv
- **THEN** it MUST produce a single merged auto-generated
  `-c developer_instructions=...` argument
- **AND** that argument MUST contain both the internal hint and the
  `## Curated Skills` block for `lazy-senior-dev`
- **AND** the presence of the internal hint MUST NOT cause the curated
  skill block to be skipped.

#### Scenario: disabled skill is not injected

- **GIVEN** `AppSettings.enabledCuratedSkillIds` does not contain
  `lazy-senior-dev`
- **WHEN** the user starts a new conversation
- **THEN** the engine MUST NOT include a `<skill id="lazy-senior-dev">`
  block in the system prompt.

#### Scenario: toggle change is observed on the next CLI launch

- **GIVEN** a session is mid-flight and the user toggles
  `lazy-senior-dev` off in Settings
- **WHEN** the user sends the next message in the same session
- **THEN** Claude-style per-turn CLI launches and Codex app-server
  replacement launches MUST both pick up the new `enabledCuratedSkillIds`
- **AND** disabling a curated skill MUST remove its `<skill id="...">`
  block from the next turn's prompt/instructions
- **AND** in-flight turns are not retroactively rewritten.

#### Scenario: Settings toggle restarts Codex app-server snapshots

- **GIVEN** `lazy-senior-dev` is enabled and a Codex app-server runtime is
  already connected
- **WHEN** the user toggles `lazy-senior-dev` off in
  `Settings > Skills > Curated`
- **THEN** the toggle IPC MUST update `AppSettings.enabledCuratedSkillIds`
  through the same restart-aware settings path as other Codex launch-affecting
  settings
- **AND** `app_settings_change_requires_codex_restart` MUST return true for
  additions, removals, or reordering of `enabledCuratedSkillIds`
- **AND** the existing Codex app-server runtime MUST be replaced so the next
  Codex turn cannot observe the stale `developer_instructions` block
- **AND** if replacement fails, the settings write MUST be rolled back and an
  actionable error returned instead of leaving UI state and runtime prompt
  state inconsistent.

### Requirement: Curated Skill Bodies MUST Be Transported Safely Per Engine Launch Path

Enabled curated skill bodies MUST be available to supported engine launches when the selected launch path can transport them safely. The system MUST avoid placing large ccgui-generated curated skill bodies in Windows argv when that transport is known to break session startup.

#### Scenario: Codex macOS/Linux launch receives enabled curated skills
- **WHEN** `enabledCuratedSkillIds` contains `lazy-senior-dev`
- **AND** Codex app-server launch is macOS or Linux
- **THEN** Codex launch args MUST include generated `developer_instructions` containing `<skill id="lazy-senior-dev">`.

#### Scenario: Codex Windows launch omits generated curated argv
- **WHEN** `enabledCuratedSkillIds` contains `lazy-senior-dev`
- **AND** Windows builds Codex app-server launch args
- **THEN** launch argv MUST NOT include generated `developer_instructions` containing `<skill id="lazy-senior-dev">`
- **AND** launch argv MUST NOT use `--profile ccgui-generated-instructions`.

#### Scenario: Codex Windows turns receive enabled curated skills
- **WHEN** `enabledCuratedSkillIds` contains `lazy-senior-dev`
- **AND** a Codex turn starts on Windows with collaboration mode support
- **THEN** `turn/start.collaborationMode.settings.developer_instructions` MUST include `<skill id="lazy-senior-dev">`
- **AND** it MUST also preserve existing execution policy developer instructions.

#### Scenario: user override wins
- **WHEN** user-supplied Codex args already include `developer_instructions=` or `instructions=`
- **THEN** curated injection MUST NOT overwrite the user override
- **AND** wrapper compatibility retry MUST NOT create a competing generated curated-skill transport for that launch.

#### Scenario: Claude Windows omits curated append argv
- **WHEN** `enabledCuratedSkillIds` contains `lazy-senior-dev`
- **AND** Claude Code launch runs on Windows
- **THEN** Claude launch args MUST NOT include `--append-system-prompt` with the generated curated skill body
- **AND** the user message MUST still be sent through the existing stream-json stdin path
- **AND** macOS and Linux Claude launches MUST keep the existing curated skill append behavior.

#### Scenario: Claude Windows mirrors enabled curated skills into effective Claude home
- **WHEN** `enabledCuratedSkillIds` contains `lazy-senior-dev`
- **AND** Claude Code launch runs on Windows
- **THEN** ccgui MUST write the bundled skill body to `<effective Claude home>/skills/lazy-senior-dev/SKILL.md`
- **AND** effective Claude home MUST resolve from configured Claude home, then `CLAUDE_HOME`, then the platform default Claude home
- **AND** this mirror MUST happen without adding the skill body to process argv.

#### Scenario: Claude Windows mirror protects user-owned skills
- **WHEN** `<effective Claude home>/skills/lazy-senior-dev` already exists
- **AND** it is not marked as ccgui-managed
- **THEN** ccgui MUST NOT overwrite or delete the existing user-owned skill directory
- **AND** Claude launch MUST still avoid `--append-system-prompt` argv.

#### Scenario: Claude Windows mirror removes disabled managed skills
- **WHEN** `lazy-senior-dev` was previously mirrored by ccgui
- **AND** `enabledCuratedSkillIds` no longer contains `lazy-senior-dev`
- **THEN** ccgui MUST remove only the ccgui-managed mirror directory
- **AND** user-owned directories without the ccgui marker MUST remain untouched.

#### Scenario: Claude Windows activates enabled native skills through a prompt file
- **WHEN** `enabledCuratedSkillIds` contains `lazy-senior-dev`
- **AND** Claude Code launch runs on Windows
- **THEN** ccgui MUST write a short activation hint file under the effective Claude home
- **AND** Claude launch args MUST include `--append-system-prompt-file <hint-file-path>`
- **AND** launch args MUST NOT include the curated skill body
- **AND** the hint file MUST instruct Claude to invoke `Skill(skill="lazy-senior-dev")` for matching coding/debugging/review/refactoring/implementation turns.

#### Scenario: Claude Windows removes activation hint when no curated skills are enabled
- **WHEN** no curated skills are enabled
- **AND** a previous ccgui-managed activation hint exists
- **THEN** ccgui MUST remove the managed activation hint
- **AND** Claude launch args MUST NOT include `--append-system-prompt-file`.

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
