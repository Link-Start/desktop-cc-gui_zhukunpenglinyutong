## ADDED Requirements

### Requirement: Native session open reports named stages

When the conversation curtain is shown for a Native / DSH / Claude (non-Shared) history restore, the surface MUST publish a `HistoryLoadingProgress` value. The curtain MUST show a named stage, a 0–100 percent, and a detail line that identifies the current step.

The progress model MUST reuse `HistoryLoadingProgress` (`prepare` | `session` | `projection` | `merge` | `finalize`). Native MUST map: select/start → `prepare`, host or disk fetch → `session`, parse/normalize → `projection`, hydrate/first-paint → `merge`, ready to drop curtain → `finalize`. Shared restore MUST keep its existing title/detail keys and percent ladder.

A `progress == null` curtain MAY keep the indeterminate climbing light. A non-null progress MUST render the spine and MUST NOT hide percent solely because the engine is not Shared.

Selecting an unloaded Native / DSH thread MUST write prepare progress in the same turn as `setThreadHistoryLoading(true)`.

#### Scenario: Native curtain shows stage and percent

- **WHEN** a DSH or other Native thread starts history restore
- **THEN** `HistoryLoadingSurface` MUST render spine nodes and a determinate percent
- **AND** the detail line MUST be a Native restore key, not `restoringSharedHistory*`

#### Scenario: Shared restore copy stays unchanged

- **WHEN** a Shared thread reports `phase: "projection"` with the existing Shared keys
- **THEN** the surface MUST still show Shared title/detail and the Projection spine label
- **AND** Shared percent semantics MUST match the pre-change ladder

#### Scenario: Unknown curtain stays indeterminate

- **WHEN** history is loading but no progress object has been published
- **THEN** the surface MAY show the climbing light
- **AND** it MUST NOT invent fake phase labels

### Requirement: DSH host pages emit progress before load returns

Local `load_dsh_session` MUST emit a `dsh-history-load-progress` event after each host `session.history` page (and once before the first page, with `pageIndex = 0`). The event MUST include `sessionId` (host id, no `dsh:` prefix), 1-based `pageIndex` after a page arrives, `maxPages`, `pageEventCount`, `totalEventCount`, and `hasMore`.

The JS restore path MUST subscribe for that session before awaiting `loadDshSession`, map each event onto `HistoryLoadingProgress` in the `session` phase, and include the page numbers in `detailParams`. The curtain MUST update before the `load_dsh_session` IPC promise resolves.

Internal callers that load DSH history without a user-facing curtain (for example reading the latest assistant text after a turn) MUST NOT emit curtain progress.

Remote-mode `load_dsh_session` is not required to emit page events in this change.

#### Scenario: Page 3 then page 4 both reach the curtain

- **WHEN** DSH restore is waiting on host history and page 3 completes, then page 4 completes
- **THEN** the published progress MUST change between those two events
- **AND** both detail payloads MUST include the corresponding page index
- **AND** the update MUST happen before `loadDshSession` resolves

#### Scenario: Internal history read stays silent

- **WHEN** Rust loads DSH history to read the latest assistant text after a turn
- **THEN** it MUST NOT emit `dsh-history-load-progress`

### Requirement: Progress equality includes detail params

`setThreadHistoryLoadingProgress` MUST treat two progress values as different when their `detailParams` differ, even if `phase`, `percent`, `titleKey`, and `detailKey` are identical. It MUST still skip a write when the full progress (including `detailParams`) is unchanged.

JS stages that run on the renderer thread after a long IPC MUST yield at least one animation frame before starting the next expensive step, so the just-published stage can paint. Yielding MUST NOT clear the curtain or mark the thread loaded.

#### Scenario: Same percent different page still updates

- **WHEN** two consecutive DSH page events share the same `percent` but different `page` detail params
- **THEN** the stored progress for that thread MUST become the later event

#### Scenario: Yield does not finish the restore

- **WHEN** restore yields so the parse stage can paint
- **THEN** `historyLoading` for that thread MUST remain true
- **AND** the thread MUST NOT be marked loaded solely because of the yield
