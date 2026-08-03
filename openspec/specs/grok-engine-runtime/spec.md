# grok-engine-runtime Specification

## Purpose

TBD - created by archiving change for `grok-engine-runtime`.

## Requirements

### Requirement: Grok One-Shot Engine Runtime

Grok CLI SHALL run as a one-shot headless engine (`grok -p --output-format streaming-json
--always-approve`) with streaming text and reasoning surfaced to the conversation UI.

#### Scenario: New Grok turn on a new thread

- **WHEN** the user sends the first message on a `grok-pending-*` thread
- **THEN** backend SHALL spawn `grok -p` with `--output-format streaming-json` and `--always-approve`
- **AND** the new session SHALL be created with a backend-generated UUID via `-s/--session-id`
- **AND** `SessionStarted` SHALL carry that canonical UUID before any content event

#### Scenario: Continue an existing Grok session

- **WHEN** the user sends a message on a `grok:<uuid>` thread with continue semantics
- **THEN** backend SHALL pass `-r/--resume <uuid>` and SHALL NOT pass `-s/--session-id`

#### Scenario: Stream event mapping

- **WHEN** the CLI emits NDJSON lines on stdout
- **THEN** `text` lines SHALL map to `TextDelta`
- **AND** `thought` lines SHALL map to `ReasoningDelta`
- **AND** an `end` line SHALL produce `TurnCompleted` carrying the accumulated text
- **AND** an `error` line SHALL produce `TurnError`
- **AND** unknown or future event types SHALL be skipped without failing the turn

#### Scenario: Preserve the complete streamed response after turn completion

- **WHEN** Grok emits multiple `text` deltas followed by `end` without a separate assistant `item/completed`
- **THEN** frontend SHALL drain the externalized live-text tail into the same assistant item before final settlement
- **AND** the static conversation timeline SHALL retain the complete response after streaming state ends or history is refreshed

#### Scenario: Interrupt a running Grok turn

- **WHEN** the user stops a running Grok turn
- **THEN** backend SHALL kill the child process registered for that turn id
- **AND** the turn SHALL settle as stopped (exit 130/143 maps to "Session stopped.")

### Requirement: Grok Session History

Grok sessions stored under `$GROK_HOME/sessions/<url-encoded-cwd>/<uuid>/` SHALL be
listable, loadable, and deletable from the GUI, scoped to the current workspace.

#### Scenario: List sessions for a workspace

- **WHEN** the sidebar requests Grok history for a workspace
- **THEN** backend SHALL enumerate session directories whose decoded and canonicalized cwd matches the workspace path (including symlink variants)
- **AND** each entry SHALL expose id, title (from `summary.json`), timestamps, and message counts

#### Scenario: Load a session transcript

- **WHEN** the user opens a `grok:<uuid>` history thread
- **THEN** backend SHALL parse `chat_history.jsonl` into user / assistant / reasoning / tool messages
- **AND** synthetic system-reminder user entries SHALL be skipped
- **AND** `<user_query>` wrappers SHALL be stripped from user text
- **AND** unknown line types SHALL be skipped

#### Scenario: Delete a session

- **WHEN** the user deletes a Grok history thread
- **THEN** backend SHALL remove the session directory for that UUID
- **AND** the operation SHALL target only the real on-disk session id

### Requirement: Grok CLI Lifecycle

The settings view SHALL expose Grok CLI detection, install, upgrade, and doctor diagnostics.

#### Scenario: Detect Grok CLI status

- **WHEN** engine status is collected
- **THEN** backend SHALL resolve the grok binary (custom `grokBin` first, then PATH lookup)
- **AND** report version, `GROK_HOME`-aware config state, and available models from `config.toml` with generated-catalog fallback

#### Scenario: Run Grok doctor

- **WHEN** the user triggers Grok doctor in settings
- **THEN** backend SHALL run `grok doctor` and return structured diagnostics aligned with the other engines

### Requirement: Grok Vendor Providers

The vendor panel SHALL manage Grok third-party providers and materialize the active
provider into `~/.grok/config.toml` under a `ccgui/` namespace.

#### Scenario: Switch to a managed provider

- **WHEN** the user activates a managed Grok provider
- **THEN** backend SHALL upsert `[model."ccgui/<model-name>"]` with `model` / `base_url` / `name` / `api_key` / `api_backend` / `context_window`
- **AND** set `[models] default = "ccgui/<model-name>"` with a `.bak` backup and atomic write
- **AND** sessions for that provider SHALL run with an isolated `GROK_HOME`

#### Scenario: Local pseudo-provider

- **WHEN** the user selects the `__local_config_toml__` pseudo-provider
- **THEN** backend SHALL leave `~/.grok/config.toml` untouched and run with the default `GROK_HOME`
