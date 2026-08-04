## MODIFIED Requirements

### Requirement: Binding Provisioning Is Durable Before Runtime Side Effects

Binding provisioning MUST persist its state (`prepared → creating → ready / recovery-required`) in `shared_binding_state` before invoking the runtime. When the identity ACK is ambiguous, the binding MUST enter `recovery-required`; the system MUST NOT blindly create a second native session for the same target.

For Shared-supported local CLIs, the durable `native_session_id` MUST converge to the identity used by native history listing so Hidden Binding hide filters can match:

- **Grok**: materialize MUST pre-assign a stable `grok:{uuid}` (or equivalent established identity) and first create MUST reuse that id instead of generating a divergent session id.
- **Kimi / OpenCode**: when the runtime finalizes a real session id after first create, the durable binding MUST be updated to that real id before the next list/hide cycle relies on it.

#### Scenario: crash during provisioning is recoverable

- **WHEN** the process crashes after binding provisioning is persisted but before runtime acceptance
- **THEN** on restart the binding MUST be recoverable from its durable provisioning state

#### Scenario: ambiguous identity ack enters recovery-required

- **WHEN** runtime identity acknowledgement is ambiguous for a binding operation
- **THEN** the binding MUST transition to `recovery-required`
- **AND** the system MUST NOT create another native session for the same target without explicit rebuild

#### Scenario: explicit rebuild archives old binding

- **WHEN** the user explicitly rebuilds a `recovery-required` binding
- **THEN** the old binding metadata MUST be archived

#### Scenario: grok binding identity matches disk session id

- **WHEN** Shared V2 materializes a Grok Hidden Binding and dispatches the first turn
- **THEN** the durable binding `native_session_id` MUST match the Grok session id that appears in native history listing (modulo the standard `grok:` prefix normalization)
- **AND** the system MUST NOT leave the binding stuck on a `grok-pending-shared-*` placeholder after a successful first create

#### Scenario: kimi or opencode binding rebinds to finalized session id

- **WHEN** Shared V2 dispatches a first turn on Kimi or OpenCode and the runtime later reports a finalized native session id
- **THEN** the durable binding MUST update `native_session_id` to that finalized identity
- **AND** subsequent Shared list responses MUST expose that identity in `nativeThreadIds` for hide filtering
