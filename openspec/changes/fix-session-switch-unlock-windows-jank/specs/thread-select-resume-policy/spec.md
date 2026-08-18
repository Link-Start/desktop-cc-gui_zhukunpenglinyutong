## ADDED Requirements

### Requirement: Empty hydrated surfaces MUST NOT force resume on every select

Selecting an already-hydrated empty thread (including empty Claude `claude:*` with zero items) MUST NOT force `resumeThreadForWorkspace` on every click. The system MUST keep `loadedThreadsRef` false after empty hydrate (empty-retry contract unchanged).

#### Scenario: Loaded empty Claude respects the refresh cooldown

- **GIVEN** a Claude thread whose item list is empty and `loadedThreadsRef` is true
- **AND** the thread is not processing
- **AND** last refresh is within the 20s loaded-refresh window
- **WHEN** the user selects that thread again
- **THEN** the system MUST NOT schedule a resume

#### Scenario: Failed history does not automatically resume

- **GIVEN** `historyLoadingState` for the thread is `failed`
- **AND** the thread is not processing
- **WHEN** the user selects that thread
- **THEN** the system MUST NOT schedule another automatic resume
- **AND** an explicit `refreshThread` MUST still be allowed to retry

#### Scenario: Unloaded empty surface uses a 20s cooldown

- **GIVEN** a thread with zero items and `loadedThreadsRef` is false
- **AND** the thread is not a known never-started session
- **AND** a resume was already scheduled for that empty surface within 20s
- **WHEN** the user selects the same thread again
- **THEN** the system MUST skip another resume until the cooldown elapses

### Requirement: Known never-started sessions MUST NOT resume on select

The system MUST skip `resumeThreadForWorkspace` only when never-started can be known. An unloaded empty item list alone MUST NOT be treated as never-started, because that is also the pre-resume state of sessions that have history.

#### Scenario: Pending thread ids skip resume

- **GIVEN** the selected thread id contains `-pending-`
- **WHEN** the user selects that thread
- **THEN** the system MUST NOT schedule a resume

#### Scenario: Explicit empty disk metadata skips resume

- **GIVEN** the sidebar summary has `sizeBytes === 0` and no `physicalPath`
- **AND** the thread is not loaded and has zero items
- **WHEN** the user selects that thread
- **THEN** the system MUST NOT schedule a resume

#### Scenario: Empty disk size survives catalog merge

- **GIVEN** Session Index first paint recorded `sizeBytes === 0` for a thread
- **WHEN** a later catalog or live-list merge omits size or passes a missing size field
- **THEN** the merged sidebar summary MUST keep `sizeBytes === 0`
- **AND** `extractThreadSizeBytes` MUST return `0` for an explicit zero and `undefined` for a missing field

#### Scenario: Missing summary still resumes unloaded history

- **GIVEN** the thread is not in the sidebar summary list
- **AND** `loadedThreadsRef` is false and items are empty
- **WHEN** the user selects that thread
- **THEN** the system MUST still schedule a background resume
- **AND** MUST NOT treat the missing summary as never-started

### Requirement: Unloaded Native / Shared select MUST raise a history-loading curtain

Selecting an unloaded Native or Shared thread that may have history MUST synchronously set `historyLoadingByThreadId` to `true` so the canvas does not flash `emptyThread`. Native here includes Claude, Codex, and DSH (`dsh:*`). Known never-started (`*-pending-*` or explicit `sizeBytes===0` with no `physicalPath`), already-loaded, processing, and failed surfaces MUST stay curtain-free. Shared select MUST seed prepare progress (`8%` / `restoringSharedHistoryPrepare`). DSH MUST use the boolean curtain only and MUST NOT seed Shared prepare progress. True Claude blank curtains after a loaded empty surface MUST continue to use `scheduleClaudeBlankCurtainRecovery`.

#### Scenario: Unloaded Native / Shared select shows history loading

- **GIVEN** a Claude, Codex, DSH, or Shared thread that is not loaded and is not a known never-started session
- **WHEN** the user selects that thread
- **THEN** `historyLoadingByThreadId` for that thread MUST become `true` in the select frame
- **AND** a Shared thread MUST also seed `historyLoadingProgressByThreadId` with prepare progress
- **AND** a DSH thread MUST NOT seed Shared prepare progress

#### Scenario: Known never-started select stays curtain-free

- **GIVEN** a pending thread id or a sidebar summary with `sizeBytes === 0` and no `physicalPath`
- **WHEN** the user selects that thread
- **THEN** `historyLoadingByThreadId` for that thread MUST NOT become `true`
