## ADDED Requirements

### Requirement: History open loads a tail snapshot only

When a conversation is opened through `HistoryLoader.load()` or the equivalent Native resume path, the implementation MUST fetch only a tail window of history, hydrate that tail, and then drop the blocking curtain. It MUST persist `ConversationMeta.historyHasMore` and `ConversationMeta.historyNextCursor` from the engine payload so later older-page requests can continue.

The tail window MUST NOT download the remainder of the transcript in the background. Completing open MUST NOT be implemented with a timeout.

Claude's existing disk window of 80 messages MUST remain the Claude tail. DSH MUST default to one host `session.history` page (200 messages) when the UI does not pass a larger `limit`. Engines that cannot cheaply page MUST still return a complete snapshot for that open and MUST set `historyHasMore` to false. They MUST NOT invent a cursor.

Shared restore MUST keep the existing V0 ready-gate. This change MUST NOT rebind the Shared curtain to projection completion.

#### Scenario: DSH open stops after the latest host page

- **WHEN** the user opens a DSH thread whose host history has more than one page
- **THEN** the open path MUST request at most one host page of 200 messages
- **AND** the returned snapshot MUST set `historyHasMore` from the host page
- **AND** `historyNextCursor` MUST be the `beforeSeq` needed to request the previous page
- **AND** the curtain MUST drop after that tail is hydrated

#### Scenario: Claude tail window stays 80

- **WHEN** a Claude thread is opened through the existing disk window
- **THEN** the open path MUST still use the Claude UI history window of 80
- **AND** the existing chip / `hasMore` / `nextCursor` semantics MUST remain unchanged

#### Scenario: Non-paging engine does not fake older pages

- **WHEN** Grok, Kimi, or Pi history is loaded for open
- **THEN** the snapshot MUST set `historyHasMore` to false unless that engine actually paged
- **AND** the loader MUST NOT synthesize a cursor that would drop or duplicate messages

#### Scenario: Shared V0 curtain is unchanged

- **WHEN** a Shared thread reaches V0 ready
- **THEN** the blocking curtain MUST still drop on the existing V0 gate
- **AND** projection MUST remain a background merge

### Requirement: Older history uses a shared requester registry

Clicking the existing older-history chip MUST go through `OlderHistoryRequester`. The requester MUST resolve a disk page loader by thread engine prefix. `claude:` MUST keep the Claude disk page loader and limit 80. `dsh:` MUST use the DSH page loader and limit 200. A thread whose engine has no registered disk loader MUST return false and MUST NOT apply the Claude disk window.

Chip All MUST continue to drain in-memory pending history only. It MUST NOT start a disk page.

Failed disk pages MUST leave `hasMore` and the same cursor so the user can retry. A superseded / cancelled thread MUST drop a late page.

#### Scenario: DSH chip loads the previous host page

- **WHEN** a DSH thread has `historyHasMore` and a consumable cursor
- **AND** the user clicks the older-history chip (not All)
- **THEN** the requester MUST call the DSH page loader with `before` equal to that cursor and `limit` 200
- **AND** returned items MUST be prepended without snapping the viewport to the bottom

#### Scenario: Unregistered engines stay closed

- **WHEN** the requester is asked to load older disk history for a `codex:` thread
- **THEN** it MUST return false
- **AND** it MUST NOT call any Claude or DSH disk page loader

#### Scenario: All does not start a disk page

- **WHEN** the user chooses All and only a disk cursor remains
- **THEN** the requester MUST return false
- **AND** it MUST NOT request another host or disk page

### Requirement: DSH load command carries the Claude-shaped window envelope

`load_dsh_session` MUST accept optional `limit` and `before`. `limit` is a folded-message budget. The implementation MUST translate it to `ceil(limit / 200)` host pages, clamped to `[1, 40]`. Omitted `limit` MUST default to 200 (one page). `before` MUST map to host `beforeSeq`.

The result MUST include `hasMore` and `nextCursor` (stringified seq, or null). Internal callers that only need the latest assistant text MUST use the same one-page default and MUST NOT emit curtain progress.

Remote-mode `load_dsh_session` MUST forward `limit` and `before`. It is not required to emit page-progress events.

Progress events that do fire for a user-facing load MUST report folded message counts in `pageEventCount` / `totalEventCount`, and `maxPages` MUST be the requested page budget for this call, not a hard-coded 40 when the call only asked for one page.

#### Scenario: Default DSH load is one host page

- **WHEN** `load_dsh_session` is invoked without `limit` or with `limit = 200`
- **THEN** Rust MUST call host `session.history` at most once with `maxMessages = 200`
- **AND** it MUST fold only the events from that page
- **AND** `hasMore` / `nextCursor` MUST reflect whether an older page exists

#### Scenario: before continues from the previous cursor

- **WHEN** `load_dsh_session` is invoked with `before` set to a previous `nextCursor`
- **THEN** the host request MUST pass that value as `beforeSeq`
- **AND** the returned messages MUST be the older page, not the tail already on the canvas

#### Scenario: Curtain counts are folded messages

- **WHEN** a user-facing DSH load emits `dsh-history-load-progress` after a page
- **THEN** `pageEventCount` MUST be the folded message count of that page
- **AND** `totalEventCount` MUST be the accumulated folded message count
- **AND** those values MUST NOT be the raw host `events.len()`

#### Scenario: Silent latest-assistant read stays one page

- **WHEN** Rust loads DSH history only to read the latest assistant text
- **THEN** it MUST use the one-page default
- **AND** it MUST NOT emit `dsh-history-load-progress`
