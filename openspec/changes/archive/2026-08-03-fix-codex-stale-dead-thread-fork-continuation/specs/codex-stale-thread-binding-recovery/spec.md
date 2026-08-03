## MODIFIED Requirements

### Requirement: Recover And Resend MUST Make Fresh Fallback Visible

When a user explicitly chooses a stale Codex thread recovery card continuation action, the system MUST make the continuation target clear and MUST not require the user to discover a separate Fork entry point manually.

#### Scenario: recovery card offers fork shortcut

- **WHEN** the message canvas detects a Codex stale thread recovery error
- **THEN** the recovery card MUST expose a direct Fork action in the canvas
- **AND** the user MUST NOT need to discover a separate bottom toolbar Fork menu to create a usable forked conversation

#### Scenario: recovery card explains stale thread meaning and next step

- **WHEN** the message canvas renders a Codex stale thread recovery card
- **THEN** the card MUST explain that the current Codex thread binding is no longer safe to continue
- **AND** it MUST state that the existing canvas content remains visible while the failed request needs a usable continuation thread
- **AND** it MUST present a recommended next step that tells the user to use Fork，并在 native fork 不可用时由系统新建可用会话承接
- **AND** raw provider/runtime details such as `thread not found` MUST be visually secondary to the user-facing explanation

#### Scenario: fork shortcut is a clear primary action

- **WHEN** the stale thread recovery card can offer a continuation action
- **THEN** the primary action MUST combine a Fork-oriented icon with concise text such as `Fork`
- **AND** the action label MUST NOT promise automatic resend of the previous user prompt
- **AND** the action MUST orchestrate continuation through shared workspace primitives (`forkThread` / `startThread`) rather than a one-off parallel protocol
- **AND** the action MUST NOT be wired only to bare slash-command `startFork` without dead-parent fallback
- **AND** the action MUST NOT call the recover-and-resend path that requires a previous prompt payload

#### Scenario: fork shortcut does not require runtime reacquire of the dead parent

- **WHEN** the user clicks the stale thread recovery card Fork action
- **THEN** the UI MUST NOT require a successful runtime reacquire or `thread/resume` of the already-missing parent thread before attempting continuation
- **AND** runtime readiness for a **new** fork/fresh child thread MAY still run as part of shared start/fork primitives

#### Scenario: dead parent native fork falls back to fresh continuation

- **WHEN** the user clicks the stale thread recovery card Fork action
- **AND** native `thread/fork` against the stale parent returns missing-thread failure, null, or equivalent unusable result
- **THEN** the system MUST attempt an explicit fresh Codex thread continuation via shared `startThread` (or equivalent)
- **AND** on success the UI MUST activate the fresh thread so the user can continue typing
- **AND** the system MUST NOT present the original stale parent as verified rebound
- **AND** the system MUST NOT leave the user on the dead parent with a silent no-op

#### Scenario: fork continuation reports classified success

- **WHEN** recovery-card Fork succeeds via native fork
- **THEN** the outcome MUST be classifiable as `forked` (or equivalent)
- **AND** the forked child thread MUST become the active conversation target

#### Scenario: fork and fresh both fail surface visible failure

- **WHEN** recovery-card Fork cannot produce a usable forked or fresh thread
- **THEN** the recovery surface MUST show a visible failure state
- **AND** the system MUST NOT swallow the failure as an empty success

## ADDED Requirements

### Requirement: Stale Recovery Card Fork MUST Prefer Native Fork Then Fresh

恢复卡 Fork 是 **explicit continuation**（无强制 resend）。系统 MUST 优先 native fork，失败后再 fresh，且全程结果可分类。

#### Scenario: orchestration order is fork then fresh

- **WHEN** Codex stale recovery card Fork runs
- **THEN** it MUST try `forkThreadForWorkspace` (or shared fork primitive) before creating a blank fresh thread
- **AND** only after fork yields no usable thread id MAY it call `startThreadForWorkspace` with the source engine

#### Scenario: provider binding inheritance for fresh fallback

- **WHEN** recovery-card Fork falls back to fresh continuation
- **AND** the source thread metadata contains a non-empty `providerProfileId`
- **THEN** fresh thread creation SHOULD carry the same provider binding when the start primitive supports it
- **AND** blank provider ids MUST keep disk-default behavior
