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

### Requirement: OpenCode Restoration MUST Require A New OpenSpec Change

Re-enabling OpenCode interaction or modernizing its provider/CLI contract MUST require a new product decision and OpenSpec proposal.

#### Scenario: code adds a new OpenCode entry

- **WHEN** CI detects a production OpenCode entry without a corresponding active change
- **THEN** governance validation MUST fail
