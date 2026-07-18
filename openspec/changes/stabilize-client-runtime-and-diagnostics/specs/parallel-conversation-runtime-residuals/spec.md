## ADDED Requirements

### Requirement: Gemini Execution MUST Remain Hard Disabled

The client MUST treat Gemini execution as a disabled capability at every user-facing and backend command boundary while preserving compatibility for historical session inspection and diagnostics.

#### Scenario: fresh, missing, legacy, or explicitly enabled setting is loaded
- **WHEN** application settings are created, deserialized without `geminiEnabled`, or loaded with a legacy truthy `geminiEnabled`
- **THEN** the effective runtime policy MUST normalize Gemini execution to disabled
- **AND** persisted legacy intent MUST NOT reopen the capability.

#### Scenario: a frontend or IPC caller requests Gemini execution
- **WHEN** Prompt Enhancer, Orchestration dispatch, Project Map generation, Checkpoint commit, commit-message generation, TaskRun Retry/Resume/Fork, composer, GUI IPC, daemon RPC, local mode, or remote mode attempts a new Gemini execution
- **THEN** the request MUST fail with the stable disabled diagnostic before session creation or process spawn
- **AND** the Gemini CLI MUST NOT receive prompt content or produce a spawn marker.

#### Scenario: startup engine discovery runs while Gemini is hard disabled
- **WHEN** startup, workspace add, bulk engine detection, or preferred-engine selection evaluates available engines
- **THEN** Gemini MUST be skipped or represented by a synthetic disabled status without invoking its binary
- **AND** a missing binary override MUST NOT fall back to executing `gemini --version` from `PATH`
- **AND** a legacy Gemini workspace/default MUST normalize to a supported execution engine instead of selecting Gemini.

#### Scenario: historical Gemini records are inspected
- **WHEN** a stored Gemini conversation, TaskRun, filter value, or diagnostic is opened
- **THEN** the client MAY preserve its engine identity and readable historical evidence
- **AND** inspection MUST NOT expose Retry, Resume, Fork, Generate, Dispatch, or composer actions that can create a new execution
- **AND** composer send, queued auto-flush, and direct-thread send MUST reject before any mismatch/new-thread fallback can forward the input to another Provider.

#### Scenario: a shared frontend service is called directly for Gemini
- **WHEN** a caller bypasses a visible selector and invokes thread/session or Tauri engine services with Gemini
- **THEN** the shared frontend owner MUST reject before creating a pending thread or invoking IPC
- **AND** backend rejection MUST remain a defense-in-depth gate rather than the first policy boundary.

### Requirement: Gemini Prompt Transport And Owned Child Teardown MUST Be Content-Safe And Complete

Gemini runtime launch MUST keep user prompt content out of process argv when stdin transport is supported, and every owned child handle MUST enter an explicit terminal or teardown cleanup path.

#### Scenario: Gemini turn starts with user prompt
- **WHEN** the configured Gemini CLI supports prompt input through stdin
- **THEN** the runtime MUST send the prompt through stdin
- **AND** argv MUST contain only bounded control arguments without the raw prompt.
- **AND** stdin writing and stdout/stderr draining MUST make progress concurrently so a large prompt cannot deadlock with early CLI output.

#### Scenario: Gemini turn reaches normal terminal state
- **WHEN** a registered Gemini child reaches completed, error, cancelled, or equivalent terminal state
- **THEN** the session MUST remove the owned handle and wait for child exit
- **AND** the handle MUST not remain registered after settlement.

#### Scenario: Gemini session is interrupted or removed
- **WHEN** interrupt, workspace/session removal, or teardown occurs while an owned child is still active
- **THEN** the runtime MUST issue best-effort termination for the owned process group
- **AND** descendants that ignore graceful termination MUST enter the bounded force-kill path
- **AND** it MUST wait or schedule bounded reap where asynchronous context permits.

#### Scenario: Gemini session creation races workspace removal
- **WHEN** first-time session creation overlaps workspace removal or global host shutdown
- **THEN** create/remove/shutdown MUST be serialized through the existing manager ownership boundary
- **AND** no new session owner MAY be inserted after teardown has started.

#### Scenario: a stale session owner attempts launch after teardown
- **WHEN** a caller already holds a `GeminiSession` owner before interrupt, workspace removal, or global shutdown begins
- **THEN** session launch and teardown MUST share a serialized lifecycle gate
- **AND** the stale owner MUST be rejected before spawn or be registered in time for the same teardown to kill and reap it.

#### Scenario: interrupt arrives before a turn registers its child
- **WHEN** a turn is cancelled before its child has entered `active_processes`
- **THEN** the turn cancellation MUST remain observable to the launch path
- **AND** that turn MUST NOT spawn after interrupt reports completion.

#### Scenario: owned process cleanup fails
- **WHEN** process-group termination or bounded reap fails during remove or shutdown
- **THEN** the owner MUST preserve retryable ownership and return an explicit content-safe failure
- **AND** workspace removal or host shutdown diagnostics MUST NOT claim successful cleanup from registry state alone.

#### Scenario: GUI or daemon host shuts down
- **WHEN** the GUI receives its exit event or the daemon receives a supported shutdown signal
- **THEN** the host MUST drain and interrupt its Gemini session owners before completing graceful shutdown
- **AND** shutdown MUST NOT rely on Rust `Drop` running after abrupt process termination.

#### Scenario: Drop cannot acquire the process registry lock
- **WHEN** `GeminiSession::drop` cannot acquire `active_processes` without blocking
- **THEN** Drop MUST remain non-blocking
- **AND** it MUST emit content-safe cleanup-skipped evidence
- **AND** diagnostics MUST not claim OS exit from registry state alone.
