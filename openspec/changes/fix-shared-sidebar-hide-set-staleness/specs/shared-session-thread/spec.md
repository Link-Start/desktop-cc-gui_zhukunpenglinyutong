## MODIFIED Requirements

### Requirement: Shared Session Hidden Native Bindings Stay Internal

Native bindings owned by a `shared session` are runtime internals and MUST NOT become user-facing native conversations. This rule applies to every Shared-supported engine (`Claude`, `Codex`, `Kimi`, `Grok`, `OpenCode`), not only `Claude` / `Codex`.

Thread-list hide filtering MUST use a hide set that is **fresh enough** relative to binding materialize, and MUST purge previously leaked Shared-owned native rows from any baseline snapshot before presenting the sidebar.

#### Scenario: selector change does not create a visible native conversation

- **WHEN** the user switches selected engine inside a `shared session` but has not sent a new turn
- **THEN** the system MUST persist the shared selector state for that session
- **AND** the system MUST NOT create an extra user-visible native conversation only because of that selector change

#### Scenario: shared-owned native bindings are filtered from native list surfaces

- **WHEN** thread list / tabs / reopen flows include both native sessions and shared sessions
- **THEN** native bindings marked as shared-owned internals MUST remain hidden from native conversation surfaces for Claude, Codex, Kimi, Grok, and OpenCode
- **AND** users MUST continue the conversation through the `shared session` identity

#### Scenario: grok shared binding does not appear as native sidebar row

- **WHEN** a Shared Session turn executes on Grok and materializes a Hidden Native Binding
- **THEN** the thread list MUST NOT show a separate Grok native row for that binding
  (including sessions whose first message is a context-package marker)
- **AND** the only user-facing conversation row for that work MUST remain the `shared:*` identity

#### Scenario: kimi and opencode shared bindings stay hidden after real id finalizes

- **WHEN** a Shared Session turn executes on Kimi or OpenCode and the runtime later finalizes a real native session id
- **THEN** the durable binding MUST be updated to that real identity
- **AND** subsequent thread list / catalog merges MUST hide that native id from user-facing native surfaces

#### Scenario: async native list refresh must not use a stale empty hide set

- **WHEN** the client starts a thread list while a Shared Session has no native bindings yet
- **AND** an asynchronous engine-specific native session refresh (Grok / Kimi, and any remaining Gemini refresh path) is still in flight
- **AND** a Shared turn materializes a Hidden Native Binding before that refresh completes
- **THEN** the refresh merge MUST rebuild its hide set from a current Shared session list (or an equivalent durable binding source) before merging native rows
- **AND** the refresh MUST NOT apply only the empty hide set captured at the start of the original list call
- **AND** the resulting sidebar snapshot MUST NOT contain that Shared-owned native binding id

#### Scenario: hide set failures must not widen visibility

- **WHEN** an asynchronous native list refresh fails to load the current Shared session list
- **THEN** the hide filter MUST remain at least as strict as the hide set known at the start of the parent thread-list request
- **AND** the system MUST NOT treat a failed Shared list as an empty hide set that re-exposes previously hidden bindings

#### Scenario: previously leaked shared-owned native rows are purged from baseline

- **WHEN** a prior sidebar snapshot still contains a Shared-owned native thread id (for example after a race)
- **AND** a later merge or list completion knows that id is a Shared Hidden Binding
- **THEN** the merge/list result MUST remove that id from the user-facing thread list
- **AND** the system MUST NOT preserve the leaked row solely because it existed in the baseline snapshot or because the filtered native session array is empty

#### Scenario: synchronous engines keep same-frame hide filtering

- **WHEN** Claude, Codex, or OpenCode native rows are merged on the main (synchronous) thread-list path
- **THEN** those engines MUST continue to filter Shared-owned binding ids with the hide set built for that list request
- **AND** a final hide gate MAY additionally strip any residual Shared-owned ids before the sidebar snapshot is committed
