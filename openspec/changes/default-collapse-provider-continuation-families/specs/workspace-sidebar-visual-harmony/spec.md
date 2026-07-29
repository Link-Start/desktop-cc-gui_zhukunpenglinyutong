## MODIFIED Requirements

### Requirement: Conversation Family Group MUST Use A Lightweight Non-Hierarchical Boundary

Sidebar MUST render an eligible Provider Continuation Family with a low-emphasis enclosing boundary and a descriptive disclosure label. The boundary MUST communicate related continuity without resembling a Parent-Child Tree, user-created folder, or second active selection surface. Each `ThreadList` instance MUST default eligible Family groups to collapsed local UI state.

#### Scenario: lightweight boundary labels visible members

- **WHEN** an eligible Family presentation group contains two or more visible top-level members
- **THEN** Sidebar MUST initially render one visually continuous collapsed boundary containing the first ordered representative Session
- **AND** the disclosure control MUST expose the localized label `续接会话 · {{count}} 个`
- **AND** `count` MUST equal all visible top-level Family members in the current list partition, including members hidden by the collapsed presentation

#### Scenario: disclosure expands and collapses family members

- **WHEN** the user activates a collapsed Family disclosure control
- **THEN** Sidebar MUST render all Family members in their existing projected order
- **AND** the control MUST expose `aria-expanded=true`
- **WHEN** the user activates the expanded control again
- **THEN** Sidebar MUST return to the collapsed representative-only presentation
- **AND** the control MUST expose `aria-expanded=false`

#### Scenario: single visible member has no empty group chrome

- **WHEN** filtering, deletion, archiving, pagination, or pinning leaves fewer than two visible members in a partition
- **THEN** Sidebar MUST omit the Family boundary and label
- **AND** the remaining Session row MUST retain its existing Origin badge and ordinary top-level layout

#### Scenario: group chrome preserves row interaction states

- **WHEN** a rendered grouped member is active, hovered, keyboard-focused, processing, reviewing, unread, degraded, or awaiting a destructive-action confirmation
- **THEN** the row's existing state indication and hit targets MUST remain visible and operable
- **AND** the Family disclosure control MUST NOT trigger Session selection or intercept row context-menu behavior

#### Scenario: boundary remains distinct from Subagent tree

- **WHEN** a grouped root Session contains expanded Subagent descendants
- **THEN** the light boundary MAY contain that existing subtree as part of the root block
- **AND** the boundary MUST NOT add tree rails, Parent-Child indentation, ownership labels, or Subagent semantics to Family peers

#### Scenario: narrow and virtualized lists preserve the boundary

- **WHEN** Sidebar uses a narrow common width or activates virtualized ThreadList rendering
- **THEN** the disclosure label, corners, and left and right boundary MUST remain visible without clipping representative row content
- **AND** expanding the Family MUST restore the same member order, count, selection targets, and accessible label as non-virtualized rendering

#### Scenario: themes retain low-emphasis contrast

- **WHEN** Sidebar renders in supported light, dark, or system appearance
- **THEN** the boundary and disclosure label MUST remain perceivable against the Sidebar surface
- **AND** they MUST remain visually weaker than the active Session highlight and workspace/folder hierarchy
