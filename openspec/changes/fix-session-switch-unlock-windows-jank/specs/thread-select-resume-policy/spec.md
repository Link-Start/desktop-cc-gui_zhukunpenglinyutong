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

### Requirement: Session select MUST NOT raise a history-loading curtain

Selecting a thread MUST NOT synchronously set `historyLoadingByThreadId` to `true`. Unloaded sessions that may have history resume in the background. True Claude blank curtains MUST continue to use `scheduleClaudeBlankCurtainRecovery`.

#### Scenario: Empty surface select does not show history loading

- **GIVEN** a Claude or Shared thread with zero items that is not loaded
- **WHEN** the user selects that thread
- **THEN** `historyLoadingByThreadId` for that thread MUST NOT become `true` in the select frame
