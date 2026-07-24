# settings-view-type-safety Specification

## Purpose

Defines the settings-view-type-safety behavior contract, covering SettingsView shell hygiene: the shell MUST NOT retain render branches keyed on `activeSection` values outside the `SettingsViewSection` union (dead branches and their dead references are removed together), and the file MUST remain under full typecheck protection without a `// @ts-nocheck` directive, with residual type errors fixed inside the file boundary and without changing `settings-view/` child component props contracts.
## Requirements
### Requirement: SettingsView shell remains free of unreachable section branches

The SettingsView shell component SHALL NOT contain render branches keyed on `activeSection` values that are not members of the `SettingsViewSection` union, and references that become dead solely because of such branch removal SHALL be removed together with the branch.

#### Scenario: Unreachable skills section branch is removed

- **WHEN** the `activeSection === "skills"` render branch is evaluated against the `SettingsViewSection` union
- **THEN** the branch MUST be removed from `SettingsView.tsx` because `"skills"` is not a reachable section
- **AND** the live MCP `skills` subtab path (`mcpManagementSubTab === "skills"`) MUST remain functional
- **AND** any import or reference that becomes dead solely due to this removal MUST be cleaned up in the same change

### Requirement: SettingsView shell stays under full typecheck protection

The SettingsView shell component SHALL remain typed without a `// @ts-nocheck` directive, and residual type errors inside the file SHALL be fixed within the file boundary without changing the props contracts of `settings-view/` child components.

#### Scenario: ts-nocheck is removed after residual error remediation

- **WHEN** the residual `tsc` errors in `SettingsView.tsx` are remediated inside the file
- **THEN** the `// @ts-nocheck` directive on line 1 MUST be removed
- **AND** `tsc --noEmit` MUST pass across the project
- **AND** the props contracts of `settings-view/` child components MUST NOT be modified by this remediation

#### Scenario: Remediation requires a child contract change

- **WHEN** a residual error cannot be fixed without changing a `settings-view/` child component props contract
- **THEN** the remediation MUST stop for that error and the conflict MUST be reported instead of hard-changing the contract

