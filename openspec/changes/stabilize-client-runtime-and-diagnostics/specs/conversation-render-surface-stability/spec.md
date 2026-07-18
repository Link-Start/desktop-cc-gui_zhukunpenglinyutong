## ADDED Requirements

### Requirement: History Reopen MUST Not Convert Degraded Empty Evidence Into Authoritative Empty

History hydration and reopen MUST distinguish a proven empty conversation from a degraded or failed empty response.

#### Scenario: optimistic pending thread is selected

- **WHEN** a local optimistic thread id matches the `codex-pending-*` contract
- **THEN** resume MUST preserve the local thread surface and mark the local draft loaded
- **AND** it MUST NOT invoke a backend history loader
- **AND** it MUST NOT record `history-hydrate-empty`.

#### Scenario: last-good transcript exists and reopen returns degraded empty

- **WHEN** a conversation has a last-good readable transcript
- **AND** local hydration, snapshot hydration, or runtime reopen temporarily returns empty or fails
- **THEN** the client MUST preserve the last-good readable transcript
- **AND** it MUST record a bounded recovery outcome instead of replacing the surface with an empty-thread placeholder.

#### Scenario: bounded recovery also fails

- **WHEN** the client performs its one allowed automatic reopen or refresh recovery
- **AND** no readable transcript or authoritative empty proof is produced
- **THEN** the client MUST stop automatic retries
- **AND** it MUST expose a degraded/failed history state with a stable reason code.
- **AND** it MUST NOT mark the failed recovery as successfully restored or loaded.

#### Scenario: failed thread is selected again without explicit retry

- **WHEN** one canonical thread has consumed its automatic recovery and remains degraded or failed
- **AND** the user switches away and later selects that thread again, or another caller directly resumes the same canonical thread
- **THEN** every alias and caller MUST preserve the failed readable surface without another automatic loader call
- **AND** only an explicit user Retry action MAY re-arm one bounded recovery attempt.

#### Scenario: an older history request settles after a newer request

- **WHEN** overlapping requests exist for the same canonical thread
- **AND** the older generation completes after a newer generation has already published readable or failed state
- **THEN** the older generation MUST NOT write loaded/failed flags, replace items, switch aliases, or hydrate queues
- **AND** the newest generation MUST remain the sole state owner.

#### Scenario: legacy fallback or replacement candidate is also empty

- **WHEN** the primary loader fails and a legacy fallback still produces no readable items
- **OR** stale-thread recovery selects a replacement candidate whose bounded hydration also remains empty
- **THEN** the client MUST keep the source conversation active and preserve its last-good surface
- **AND** it MUST NOT write `restoredAt`, persist an alias, clear the source queue, or switch the active thread to the empty candidate.

#### Scenario: backend proves conversation is empty

- **WHEN** an authoritative history source confirms the conversation contains no readable items
- **THEN** the client MAY render the normal empty-thread state
- **AND** last-good degraded fallback MUST NOT fabricate deleted content as current truth.
