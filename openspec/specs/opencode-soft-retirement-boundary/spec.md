# opencode-soft-retirement-boundary Specification

## Purpose

定义 OpenCode soft-retirement 的产品边界：保留历史兼容读取能力，但关闭所有生产交互与执行入口。

## Requirements

### Requirement: OpenCode MUST Be Unreachable From Production Interaction Entry Points

OpenCode MUST remain disabled in frontend/backend policy and MUST NOT appear in settings、engine selection、composer or workspace entry points.

#### Scenario: legacy enabled setting is loaded

- **WHEN** persisted configuration contains OpenCode enabled
- **THEN** settings normalization MUST force the effective value to disabled
- **AND** the legacy value MUST NOT restore a production entry

### Requirement: Retired OpenCode UI MUST Not Remain In The Root Runtime Chain

AppShell MUST NOT mount OpenCode-specific selection/runtime hooks or load OpenCode-only global CSS; unreachable panel code MUST be deleted or excluded from production bundle.

#### Scenario: application shell starts

- **WHEN** AppShell initializes
- **THEN** no OpenCode-specific root hook or timer MUST run
- **AND** no OpenCode-only stylesheet MUST be eagerly loaded

### Requirement: OpenCode Compatibility Paths MUST Fail Closed For Execution

History/diagnostic compatibility MAY remain, but production start/send/control commands MUST reject OpenCode while retirement policy is active.

#### Scenario: stale caller attempts OpenCode send

- **WHEN** a stale internal caller invokes OpenCode execution
- **THEN** backend policy MUST reject before process spawn
- **AND** the error MUST identify retirement policy

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

### Requirement: OpenCode Restoration MUST Require A New OpenSpec Change

Re-enabling OpenCode interaction or modernizing its provider/CLI contract MUST require a new product decision and OpenSpec proposal.

#### Scenario: code adds a new OpenCode entry

- **WHEN** CI detects a production OpenCode entry without a corresponding active change
- **THEN** governance validation MUST fail
