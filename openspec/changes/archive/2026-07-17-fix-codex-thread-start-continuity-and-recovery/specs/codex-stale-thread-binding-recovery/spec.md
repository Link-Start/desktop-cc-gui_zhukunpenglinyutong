## MODIFIED Requirements

### Requirement: First-Turn Stale Codex Drafts MUST Use Fresh Continuation Semantics

Codex stale-thread recovery MUST distinguish durable stale conversation identities, disposable local first-turn drafts, and native threads already returned by `thread/start`.

#### Scenario: local empty stale draft can be replaced without manual recovery card
- **WHEN** a Codex thread identity fails with `thread not found`
- **AND** canonical accepted-turn / durable-activity facts prove the identity is a local disposable first-send draft that never reached native `thread/start`
- **AND** current optimistic user intent is still available
- **THEN** the system MAY replace the stale draft with a fresh Codex thread for the current first prompt
- **AND** the primary user path MUST continue the prompt in the fresh thread rather than asking the user to recover the old empty identity
- **AND** this fresh replacement MUST be attempted before stale fork fallback for the same failed local disposable draft

#### Scenario: native thread-start draft is not silently replaced
- **WHEN** a Codex thread identity has been returned by native `thread/start`
- **AND** frontend accepted-turn facts mark the empty draft source as `thread-start`
- **AND** the first send fails with `thread not found` or refresh returns no verified replacement
- **THEN** the system MUST NOT silently create a second fresh thread
- **AND** the system MUST settle through verified rebind, explicit continuation, or visible failure semantics

#### Scenario: same-id refresh does not verify a missing first-turn draft
- **WHEN** a newly started Codex empty draft fails the first prompt with `thread not found`
- **AND** refresh/rebind returns the same `threadId` that just failed
- **THEN** the system MUST NOT treat that same id as a verified rebind
- **AND** the system MUST continue through allowed local-draft fresh replacement or visible failure semantics rather than retrying the same missing id as recovered

#### Scenario: cold-start missing thread gets bounded readiness retry
- **WHEN** the first `turn/start` after Codex runtime cold start reports `thread not found`
- **THEN** the backend SHOULD perform same-runtime `thread/resume` plus short bounded readiness retry before surfacing the failure
- **AND** the retry MUST remain bounded and MUST NOT route the request to another provider/runtime

#### Scenario: durable or unknown stale thread still requires verified rebind or explicit continuation
- **WHEN** a Codex thread identity fails after one or more accepted user turns or durable activity facts exist
- **OR** the system cannot prove that the failed identity is a current local disposable first-send draft
- **THEN** the system MUST first attempt verified rebind through the existing stale-thread recovery contract where available
- **AND** fresh continuation MUST be explicit and user-visible rather than silently replacing the old thread

### Requirement: Empty Draft Fresh Replay MUST Be Single-Shot And Non-Alias-Rebinding

When Codex stale binding recovery replaces an empty first-turn draft with a fresh thread, the replacement MUST behave as a single-shot prompt continuation rather than a verified stale-thread rebind.

#### Scenario: local empty draft replay happens at most once
- **WHEN** a local first-turn empty Codex draft hits a recoverable missing-thread error
- **AND** the draft has not reached native `thread/start`
- **THEN** the system MAY create a fresh Codex thread and replay the current prompt once
- **AND** repeated missing-thread failure MUST settle to visible recovery or error state rather than looping through fresh replacements

#### Scenario: native thread-start draft does not use empty-draft replay
- **WHEN** the empty draft source is `thread-start`
- **THEN** empty-draft replay MUST NOT create another fresh thread automatically
- **AND** diagnostics or visible error state MUST distinguish this from local disposable draft replay

#### Scenario: empty draft replacement does not persist durable alias
- **WHEN** a first-turn empty Codex draft is replaced by a fresh thread
- **THEN** the system MUST NOT persist an alias that claims the old thread identity was verified as recovered
- **AND** diagnostics MUST distinguish the result from durable stale-thread rebind

### Requirement: Codex Create Session Shutdown Race Retry MUST Stay Bounded Across Entrypoints

Codex create-session entrypoints MUST share stopping-runtime race semantics: reject a runtime that is already ending, perform at most one fresh reacquire/retry where allowed, use bounded same-runtime readiness confirmation after `thread/start`, and settle persistent races as recoverable create-session errors.

#### Scenario: app create-session retries once after stopping runtime race

- **WHEN** the Tauri Codex `start_thread` command starts a session
- **AND** the first `thread/start` attempt fails because the bound runtime ended during manual shutdown or equivalent stopping lifecycle
- **THEN** the app path MUST perform one fresh runtime acquire before retrying `thread/start`
- **AND** it MUST NOT retry non-runtime errors such as workspace connectivity failures

#### Scenario: persistent app race returns stable recoverable error

- **WHEN** the app create-session retry also fails with a stopping-runtime race
- **THEN** the app path MUST return a stable recoverable create-session error such as `[SESSION_CREATE_RUNTIME_RECOVERING]`
- **AND** it MUST NOT enter an unbounded retry loop

#### Scenario: daemon create-session keeps parity with app path

- **WHEN** the daemon `start_thread` path observes the same stopping-runtime race
- **THEN** it MUST use the same bounded retry and recoverable-error semantics as the app path
- **AND** daemon parity MUST NOT create a second retry strategy that diverges from the app command path

#### Scenario: thread-start readiness confirmation is bounded

- **WHEN** `thread/start` returns a valid thread id
- **AND** immediate readiness confirmation reports `thread not found`
- **THEN** backend MUST retry same-runtime `thread/resume` with a finite delay schedule
- **AND** failure after the schedule MUST return a bounded readiness error
- **AND** backend MUST NOT route readiness confirmation to another provider or create a substitute thread

#### Scenario: thread-start readiness rejects false-ready resume responses

- **WHEN** `thread/start` returns a valid thread id
- **AND** `thread/resume` returns an RPC error other than a retryable missing-thread error
- **OR** `thread/resume` returns a different thread identity than the one being confirmed
- **THEN** backend MUST fail create-session readiness before frontend activation
- **AND** backend MUST NOT treat the response as ready merely because it was not classified as `thread not found`
- **AND** frontend MUST NOT retry by calling create-session again after a post-start readiness failure

#### Scenario: active workspace prewarms disk Codex runtime only

- **WHEN** a workspace is active and connected
- **THEN** the client MAY prewarm the disk/default Codex runtime by asking backend to ensure the workspace Codex app-server session exists
- **AND** the prewarm path MUST NOT call `thread/start` or create an empty Codex conversation
- **AND** the prewarm path MUST NOT prewarm managed provider profiles
- **AND** repeated prewarm attempts for the same active workspace SHOULD be deduped while in flight or after success

#### Scenario: thread-start readiness tolerates rollout-pending resume responses

- **WHEN** `thread/start` returns a valid thread id
- **AND** `thread/resume` returns `no rollout found for thread id` during the bounded readiness window
- **THEN** backend MUST treat the response as retryable not-ready for the same runtime and same thread
- **AND** backend MAY soft-confirm readiness after the bounded retry window if the last failure is rollout-pending
- **AND** frontend MUST NOT create a replacement session for that post-start readiness state
