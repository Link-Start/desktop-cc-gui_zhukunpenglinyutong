## ADDED Requirements

### Requirement: Local Provider Runtime Key MUST Match Durable Attempt Identity

Every Shared-supported adapter MUST derive its local Provider Runtime key from the same canonical helper used by the durable Attempt target snapshot. Kimi and Grok local launch profiles MUST include the engine namespace, workspace identity, and canonical local Provider sentinel. Receipt validation MUST remain strict.

#### Scenario: Kimi local receipt matches the durable Attempt

- **WHEN** a Shared turn dispatches through the Kimi local Provider
- **THEN** the adapter receipt Provider Runtime key MUST equal the durable Attempt Provider Runtime key
- **AND** the turn MUST NOT enter `recovery-required` because of a workspace-only key

#### Scenario: Grok local receipt matches the durable Attempt

- **WHEN** a Shared turn dispatches through the Grok local Provider
- **THEN** the adapter receipt Provider Runtime key MUST equal the durable Attempt Provider Runtime key
- **AND** the turn MUST NOT enter `recovery-required` because of a workspace-only key

#### Scenario: mismatched receipt still fails closed

- **WHEN** any adapter returns a Provider Runtime key that differs from the durable Attempt owner
- **THEN** Shared dispatch MUST continue to reject the receipt as ambiguous
- **AND** the system MUST NOT accept aliases or engine-only fallback keys
