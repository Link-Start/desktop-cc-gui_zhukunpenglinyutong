## ADDED Requirements

### Requirement: Live Assistant Text Channel MUST Publish At A Bounded Cadence

The realtime client MUST accumulate every accepted live assistant text delta losslessly while exposing a stable published snapshot to React subscribers. The first text for a new active item MUST publish immediately; subsequent growth MUST publish at a per-thread throttle with a trailing update, without byte-size bypasses that defeat the cadence.

#### Scenario: first text publishes immediately

- **WHEN** a thread receives the first live assistant text for a new item
- **THEN** the channel MUST publish that complete first entry immediately
- **AND** the subscriber MUST NOT wait for the trailing cadence timer

#### Scenario: rapid growth coalesces to the latest snapshot

- **WHEN** multiple monotonic text updates for the same thread and item arrive inside one 48ms publish window
- **THEN** the channel MUST continue accumulating every update
- **AND** it MUST expose at most one trailing published snapshot for that window
- **AND** that snapshot MUST contain the latest complete accumulated text

#### Scenario: snapshot stays stable between notifications

- **WHEN** accumulated text changes but the next publish window has not fired
- **THEN** `getLiveAssistantTextSnapshot` MUST retain the previously published object
- **AND** the channel MUST NOT expose an unpublished snapshot without notifying subscribers

### Requirement: Live Assistant Text Terminal Operations MUST Be Lossless

Channel cleanup and identity migration MUST use the authoritative accumulated entry rather than a potentially stale published snapshot, and MUST leave no timer capable of publishing deleted or obsolete state.

#### Scenario: interruption drains unpublished text

- **WHEN** interruption drains a thread while a trailing publish is pending
- **THEN** `drainLiveAssistantTextTail` MUST return every accumulated character beyond the reducer shell
- **AND** it MUST cancel pending publication and clear both accumulated and published state

#### Scenario: clear prevents stale timer publication

- **WHEN** terminal settlement or thread deletion clears an active live entry
- **THEN** the channel MUST cancel the thread's pending timer
- **AND** no later callback MAY republish the cleared entry

#### Scenario: pending thread is renamed

- **WHEN** a pending thread id is replaced by its canonical thread id while publication is pending
- **THEN** accumulated and published state MUST migrate to the canonical id
- **AND** the old timer MUST NOT publish to the previous id
- **AND** subscribers on both ids MUST converge to the migrated state

### Requirement: Scheduled Live Markdown Commits MUST Not Remain Indefinitely Interruptible

Once live text has crossed the channel publish cadence or a Markdown scheduler timer has fired, the corresponding row and Markdown state update MUST use a deterministic commit path rather than adding another transition that can be repeatedly restarted by newer streaming values.

#### Scenario: channel-backed row receives published text

- **WHEN** an actively streaming assistant row reads text from `liveAssistantTextChannel`
- **THEN** the row MUST use the published text without applying an additional `useDeferredValue` delay
- **AND** non-channel message paths MAY preserve their existing deferred behavior

#### Scenario: Markdown throttle timer fires

- **WHEN** the bounded Markdown throttle or progressive reveal timer fires
- **THEN** its scheduled value MUST commit without being wrapped in `startTransition`
- **AND** the existing throttle interval and progressive chunk limits MUST remain available to bound render cost

### Requirement: Shared Owner Deferral MUST Expose Bounded Attribution

Shared runtime ingress that intentionally defers UI fan-out MUST expose whether it is waiting for exact owner identity or waiting behind an opened replay barrier. Unowned queue overflow MUST expose bounded cumulative drop evidence without logging message text, prompt text, tool output, or full event payloads.

#### Scenario: ingress waits for exact owner identity

- **WHEN** held Shared ingress cannot yet resolve an exact attempt owner
- **THEN** its observation MUST report `awaiting-owner-identity`
- **AND** it MUST include the bounded current unowned queue depth

#### Scenario: ingress waits behind replay barrier

- **WHEN** exact owner binding exists but replay remains in progress
- **THEN** its observation MUST report `replay-barrier`
- **AND** it MUST include the bounded barrier queue depth

#### Scenario: unowned queue reaches its cap

- **WHEN** another held ingress arrives after the unowned queue reaches its fixed limit
- **THEN** overflow evidence MUST increment a saturating cumulative drop count
- **AND** warning logs MUST be rate-bounded
- **AND** the authoritative owner and replay barrier semantics MUST remain unchanged

### Requirement: Settlement Terminal Events MUST Preserve Causal Predecessors

Every accepted app-server event pipeline MUST deliver prior events from the same workspace to the scheduled frontend consumer before delivering a settlement terminal for that workspace. Critical delivery MAY bypass timer latency and lossy/coalescing policy, but settlement MUST NOT overtake accepted message deltas, item snapshots, or item completion events.

#### Scenario: Codex batched sink receives a terminal

- **WHEN** a Codex sink has queued `item/agentMessage/delta` or `item/completed` events for a workspace and then receives `turn/completed`, `turn/error`, or `runtime/ended`
- **THEN** it MUST emit the queued events followed by the terminal in one ordered workspace batch
- **AND** periodic drain ownership and critical emission MUST be serialized until the drained batch has been emitted
- **AND** queues belonging to other workspaces MUST remain queued

#### Scenario: unified frontend backpressure receives a terminal

- **WHEN** the frontend backpressure queue contains events for the terminal's workspace
- **THEN** it MUST transfer those predecessors to the existing scheduled consumer before the terminal
- **AND** it MUST NOT synchronously execute their reducer or render work
- **AND** events for unrelated workspaces MUST remain isolated

#### Scenario: single-channel or non-Codex engine emits in source order

- **WHEN** a Codex single-channel fallback or another engine adapter emits content followed by a settlement terminal
- **THEN** the unified frontend barrier MUST preserve that observed source order
- **AND** no engine-specific duplicate terminal guard MAY be required

#### Scenario: interactive critical event arrives

- **WHEN** an approval, requestUserInput, or collaboration-mode control event arrives
- **THEN** it MAY retain urgent bypass behavior
- **AND** it MUST NOT be treated as turn settlement solely because it is critical

#### Scenario: Shared projected turn settles

- **WHEN** Shared owner projection emits replayed or live content followed by an authoritative terminal
- **THEN** the same frontend terminal barrier MUST preserve the projected event order
- **AND** this requirement MUST NOT weaken or duplicate the Shared owner replay barrier
