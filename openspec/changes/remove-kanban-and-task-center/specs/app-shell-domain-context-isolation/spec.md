# app-shell-domain-context-isolation delta — remove-kanban-and-task-center

## MODIFIED Requirements

### Requirement: Search And Composer Boundary MUST Not Depend On Unused Domains

`useAppShellSearchAndComposerSection` MUST only receive domains or fields it actually reads. Search palette, composer send, and git result opening MUST remain unchanged after narrowing. There is no kanban bridge.

#### Scenario: unused selected domain is removed

- **WHEN** a selected domain in `COMPOSER_SEARCH_DOMAIN_NAMES` has no fields read by `ComposerSearchShellBoundary`
- **THEN** that domain MUST be removed from the selected list
- **AND** focused tests MUST prove search and composer behavior remains unchanged

#### Scenario: search behavior is preserved

- **WHEN** the boundary is narrowed
- **THEN** opening/closing the search palette, resetting selection, toggling filters, and opening results MUST preserve existing behavior
- **AND** search MUST NOT expose Kanban / Task Center providers or result kinds
