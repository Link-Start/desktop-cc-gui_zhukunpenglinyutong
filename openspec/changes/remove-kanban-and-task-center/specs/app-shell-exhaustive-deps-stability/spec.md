# app-shell-exhaustive-deps-stability delta — remove-kanban-and-task-center

## REMOVED Requirements

### Requirement: App-shell transition and scheduler hooks remain behavior-compatible after dependency remediation
**Reason**: 该条款绑定 `useAppShellSections` 的 kanban panel open 与 `kanbanCreateTask` recurring scheduler。两个 kanban section 与 recurring chain 已删除。
**Migration**: Home/workspace transition dependency arrays 仍须保持 exhaustive-deps 稳定；不再存在 recurring kanban execution semantics。

## MODIFIED Requirements

### Requirement: Search and composer callbacks remain stable after dependency remediation
The system SHALL allow app-shell search and composer callbacks to include all referenced stable setter dependencies without changing search palette open/close, selection reset, filter toggle, or result-opening behavior. Home composer send (`useAppShellComposerSendSection`) SHALL remain the only extracted send path; no kanban `&@` send path exists.

#### Scenario: Search palette dependencies are completed
- **WHEN** the search palette callbacks and effects in `useAppShellSearchAndComposerSection.ts` are remediated for `react-hooks/exhaustive-deps`
- **THEN** the dependency arrays MUST include the referenced stable setters
- **AND** opening, closing, resetting selection, toggling filters, and opening search results MUST preserve existing behavior
- **AND** search results MUST NOT include Kanban / Task Center kinds
