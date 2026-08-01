## ADDED Requirements

### Requirement: Normal Session Hydration MUST Not Probe Retired OpenCode

While OpenCode soft-retirement policy is active, automatic workspace startup MUST NOT invoke retired OpenCode discovery.
Restore, focus refresh, and full-catalog hydration MUST NOT invoke
`opencode_session_list`. Historical compatibility commands MAY remain available
for explicit compatibility flows, but they MUST NOT be registered as normal
startup ownership.

#### Scenario: active workspace hydrates after application start

- **WHEN** the application performs normal thread-list hydration for an active workspace
- **THEN** hydration MUST skip the OpenCode native session-list command
- **AND** no failed `opencode_session_list` startup trace or runtime notice MUST be emitted

#### Scenario: retired command is reintroduced into startup ownership

- **WHEN** governance validation inspects production hydration defaults and startup owner records
- **THEN** validation MUST fail if normal hydration enables OpenCode session probing
- **AND** validation MUST fail if `opencode_session_list` is declared as a startup owner

#### Scenario: explicit historical compatibility is retained

- **WHEN** an explicit compatibility caller requests OpenCode historical session listing
- **THEN** the compatibility command surface MAY remain callable
- **AND** this allowance MUST NOT reactivate automatic startup or workspace hydration probing
