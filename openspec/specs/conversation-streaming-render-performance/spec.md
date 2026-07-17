# conversation-streaming-render-performance Specification

## Purpose

约束 conversation streaming hot path 的 history derivation、event snapshot、CSS animation 与 Bash output DOM reuse，避免 per-token work 持续占用主线程，同时保持 settled rendering correctness。

## Requirements

### Requirement: Streaming Does Not Rescan Full History Per Token

The conversation MUST NOT recompute history-wide derivations
(`dedupeExitPlanItemsKeepFirst`, `buildMessageActionTargets`) from scratch on
every streamed token. It MUST cache these across streaming ticks and reuse the
cached result on the fast path (a trailing message-text-only update), while
falling back to a full recompute whenever the update is not a pure trailing-text
append, so the idle/settled result is identical to a full scan.

#### Scenario: trailing-text token reuses cached derivations

- **WHEN** a streamed update only appends text to the trailing message
- **THEN** the cached dedup / action-target derivations MUST be reused without a full-history rescan

#### Scenario: structural update recomputes fully

- **WHEN** a streamed or settled update changes history structure (not a pure trailing-text append)
- **THEN** the derivations MUST be recomputed in full so the result matches a from-scratch scan

### Requirement: Superseded Snapshots Coalesce Within A Flush Tick

The pipeline MUST coalesce multiple `item/updated` snapshots for the same
`(workspace, thread, item)` that occur within one flush tick down to the newest
snapshot, and MUST do so only when the event is classified drop-eligible by the
existing drop policy. Events that are not drop-eligible MUST NOT be coalesced or
dropped.

#### Scenario: multiple drop-eligible snapshots in one tick

- **WHEN** several drop-eligible `item/updated` snapshots for the same item arrive in one flush tick
- **THEN** only the newest MUST be delivered

#### Scenario: non-drop-eligible event preserved

- **WHEN** an `item/updated` event is not classified drop-eligible
- **THEN** it MUST NOT be coalesced away

### Requirement: Streaming Animations Run On The Compositor

Streaming-state animations MUST avoid per-frame main-thread paints. The
working-text shimmer, the ingress spinner glow, and the agent-icon idle state
MUST use compositor-friendly properties (opacity / static shadow) rather than
animating `background-position` under a text clip or an animated
`filter: drop-shadow`.

#### Scenario: working indicator animates without main-thread paint

- **WHEN** the working/streaming indicators are animating
- **THEN** the animation MUST run via compositor-friendly properties
- **AND** it MUST NOT trigger a per-frame main-thread repaint

### Requirement: Bash Output Reuses DOM Across The Truncation Window

Bash tool output rendered under a sliding truncation window MUST key its lines
by absolute line index so that advancing the window reuses existing DOM rows
instead of recreating the whole visible list on each new line.

#### Scenario: new Bash output line

- **WHEN** a new line is appended and the truncation window slides
- **THEN** existing line rows MUST be reused, keyed by absolute index
- **AND** the whole visible list MUST NOT be recreated
