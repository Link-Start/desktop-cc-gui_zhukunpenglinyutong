## ADDED Requirements

### Requirement: Conversation Family Group MUST Use A Lightweight Non-Hierarchical Boundary

Sidebar MUST render an eligible Provider Continuation Family with a low-emphasis enclosing boundary and a descriptive label. The boundary MUST communicate related continuity without resembling a Parent-Child Tree, user-created folder, or second active selection surface.

#### Scenario: lightweight boundary labels visible members

- **WHEN** an eligible Family presentation group contains two or more visible top-level members
- **THEN** Sidebar MUST render one visually continuous light boundary around the group
- **AND** the first segment MUST expose the localized label `续接会话 · {{count}} 个`
- **AND** `count` MUST equal the visible top-level Family members in the current list partition

#### Scenario: single visible member has no empty group chrome

- **WHEN** filtering, deletion, archiving, pagination, or pinning leaves fewer than two visible members in a partition
- **THEN** Sidebar MUST omit the Family boundary and label
- **AND** the remaining Session row MUST retain its existing Origin badge and ordinary top-level layout

#### Scenario: group chrome preserves row interaction states

- **WHEN** a grouped member is active, hovered, keyboard-focused, processing, reviewing, unread, degraded, or awaiting a destructive-action confirmation
- **THEN** the row's existing state indication and hit targets MUST remain visible and operable
- **AND** the Family boundary MUST NOT become an interactive overlay or intercept pointer and keyboard events

#### Scenario: boundary remains distinct from Subagent tree

- **WHEN** a grouped root Session contains expanded Subagent descendants
- **THEN** the light boundary MAY contain that existing subtree as part of the root block
- **AND** the boundary MUST NOT add tree rails, Parent-Child indentation, expanders, or ownership labels to Family peers

#### Scenario: narrow and virtualized lists preserve the boundary

- **WHEN** Sidebar uses a narrow common width or activates virtualized ThreadList rendering
- **THEN** the label, top and bottom corners, and left and right boundary MUST remain visible without clipping row content
- **AND** virtualized and non-virtualized rendering MUST expose the same Family member order, count, selection targets, and accessible label

#### Scenario: themes retain low-emphasis contrast

- **WHEN** Sidebar renders in supported light, dark, or system appearance
- **THEN** the boundary and label MUST remain perceivable against the Sidebar surface
- **AND** they MUST remain visually weaker than the active Session highlight and workspace/folder hierarchy
