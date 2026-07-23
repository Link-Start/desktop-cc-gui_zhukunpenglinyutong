## ADDED Requirements

### Requirement: Workspace-scoped branch actions MUST use compact command-header controls

In the multi-repository root view, Update All and Checkout All Branch MUST render inside the command header as compact icon-only controls while preserving the existing batch action semantics.

#### Scenario: Multi-repository root view renders

- **WHEN** the branch command center displays the repository root list
- **THEN** available Update All and Checkout All Branch actions MUST render adjacent to the command search input
- **AND** repository rows MUST begin directly in the command list without a separate text action row or separator

#### Scenario: Header action is exposed accessibly

- **WHEN** a pointer、keyboard or assistive-technology user reaches a header action
- **THEN** the icon-only button MUST expose the existing localized action name through its accessible label and tooltip
- **AND** the decorative icon MUST NOT replace that accessible name

#### Scenario: Batch action is pending

- **WHEN** an Update All or Checkout All operation is pending
- **THEN** the header actions MUST preserve existing duplicate-execution guards
- **AND** Update All MUST expose its pending visual state
- **AND** mutation ordering、partial failure feedback、eligible repository coverage and refresh behavior MUST remain unchanged

#### Scenario: Single-repository command view renders

- **WHEN** the command center is scoped to one repository instead of the repository root list
- **THEN** its existing repository-scoped header actions and branch list behavior MUST remain unchanged
