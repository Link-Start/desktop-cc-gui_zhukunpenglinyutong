# shared-canonical-projection Specification

## Purpose

定义 Shared Session V2 的 Canonical Fact 到 UI 单向投影层：支持 checkpoint
增量更新、全量 rebuild、Legacy dual-read、Shadow comparison 与 Canvas
dark-launch regression gates。

## Requirements
### Requirement: Canonical Facts MUST Be Projected to ConversationItems

The `SharedProjector` MUST map each canonical fact in `shared_event_log` to a set of `ConversationItem`-compatible projection items. The projection MUST be one-way: UI items MUST NOT be used as a source of canonical facts.

#### Scenario: turnCommitted projects to assistant message and tool items

- **WHEN** a `conversation.turnCommitted` fact contains assistant text and two tool exchanges
- **THEN** the projector produces one `message` item for the assistant text
- **AND** one `tool` item per tool exchange
- **AND** each item has a stable checksum derived from the fact

#### Scenario: usageRecorded projects to usage metadata

- **WHEN** a `conversation.usageRecorded` fact is present
- **THEN** the projector produces a metadata item attached to the corresponding turn
- **AND** the item is marked as non-interactive

#### Scenario: control fact projects to system notice

- **WHEN** a `conversation.controlFact` fact indicates a cancel
- **THEN** the projector produces a system notice item with the control action

### Requirement: Projection MUST Support Checkpoint and Full Rebuild

The system MUST persist a `projectionVersion` and `throughSequence` checkpoint in `shared_projection_checkpoint`. When the projection cache is deleted or the version changes, the system MUST rebuild the projection from the full event log and produce identical item count, order, type, and checksums.

#### Scenario: incremental update uses checkpoint

- **WHEN** new events are appended after a previous projection
- **THEN** the projector reads the checkpoint
- **AND** only events with sequence greater than `throughSequence` are projected
- **AND** the checkpoint is updated to the new maximum sequence

#### Scenario: rebuild after cache deletion

- **WHEN** the projection cache is deleted and rebuild is triggered
- **THEN** the projector reads all events for the session
- **AND** produces the same item count, order, type, and checksums as the original projection

#### Scenario: version mismatch triggers rebuild

- **WHEN** the stored `projectionVersion` is lower than the current version
- **THEN** the projector invalidates the checkpoint
- **AND** performs a full rebuild

### Requirement: Legacy Snapshot MUST Be Readable with Presentation-Only Fidelity

The `LegacySharedReader` MUST read legacy V0 snapshot files and map them to `ConversationItem` items with `fidelity = "presentation-only"`. The reader MUST NOT modify the legacy file, MUST NOT fabricate tool IDs, signatures, or targets, and MUST NOT write to `shared_event_log`.

#### Scenario: legacy snapshot opened read-only

- **WHEN** a legacy V0 snapshot file is opened
- **THEN** the reader produces `ConversationItem` items with `fidelity = "presentation-only"`
- **AND** the original file is unchanged

#### Scenario: legacy snapshot missing tool metadata

- **WHEN** a legacy snapshot contains tool calls without canonical IDs
- **THEN** the reader preserves the original text and marks the item as presentation-only
- **AND** no synthetic tool ID is generated

#### Scenario: legacy snapshot unreadable

- **WHEN** a legacy snapshot file is corrupted or missing
- **THEN** the reader returns a typed error
- **AND** no projection items are produced

### Requirement: Shadow Projection MUST Be Comparable to Legacy Dual-Read

The `ShadowComparator` MUST compare the projection of the A2 Shadow Canonical Log with the Legacy dual-read projection. It MUST produce a mismatch report and MUST NOT write to any storage.

#### Scenario: matching shadow and legacy

- **WHEN** the shadow projection and legacy projection contain the same items in the same order
- **THEN** the comparator reports zero mismatches

#### Scenario: shadow has extra items

- **WHEN** the shadow projection contains items not present in legacy
- **THEN** the comparator reports them as `shadow-only` mismatches

#### Scenario: legacy has extra items

- **WHEN** the legacy projection contains items not present in shadow
- **THEN** the comparator reports them as `legacy-only` mismatches

#### Scenario: item content mismatch

- **WHEN** an item exists in both projections but with different content
- **THEN** the comparator reports a `content-mismatch` with the item ID

### Requirement: Native and Shared Projections MUST Be Isolated

The frontend MUST maintain separate DataSources for Native and Shared sessions. Native sessions MUST NOT read from `shared_event_log`; Shared sessions MUST NOT read from Native history files. Switching between Native and Shared sessions MUST NOT cause duplicate Assistant Final, Tool Exchange breakage, or render storms.

#### Scenario: native session opens without shared DB access

- **WHEN** a Native session is opened
- **THEN** the Native DataSource is used
- **AND** no query is made to `shared_event_log`

#### Scenario: shared session opens without native history access

- **WHEN** a Shared session is opened
- **THEN** the Shared DataSource is used
- **AND** no query is made to Native history files

#### Scenario: shared target switch does not remount canvas

- **WHEN** the user switches the next-turn target from Claude to Codex within a Shared session
- **THEN** the Canvas component does not remount
- **AND** existing items are not rebuilt or flickered

#### Scenario: shared background binding does not cause render storm

- **WHEN** a Shared session has a background Binding running while the canvas is closed
- **THEN** no continuous AppShell/Canvas re-render occurs

### Requirement: Canvas Regression Gate MUST Pass

The system MUST pass the Native Canvas golden fixtures and render regression tests defined in §17.6. Any failure MUST block the Shared V2 merge.

#### Scenario: native golden fixtures pass

- **WHEN** Claude and Codex Native golden fixtures are loaded
- **THEN** item order, type, and content match the fixture expectations
- **AND** no Shared DB is accessed

#### Scenario: shared live produces single assistant final

- **WHEN** a Shared session receives streaming deltas followed by a terminal commit
- **THEN** the canvas shows exactly one Assistant Final item
- **AND** live text collapses into the final item without duplication

#### Scenario: shared projection rebuild is deterministic

- **WHEN** a Shared projection is deleted and rebuilt
- **THEN** item count, order, type, and checksum match the pre-deletion projection
