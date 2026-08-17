## ADDED Requirements

### Requirement: Session select MUST commit identity before chrome

When the user selects a thread from the sidebar, workspace instance list, workspace-flows navigation, or search thread/message results, the system MUST apply workspace + thread identity synchronously, then schedule engine and chrome updates (settings close, diff cleanup, home/tab/mode, optional right-panel collapse) on a transition. The system MUST NOT introduce new AppShell domain-bag keys or flatten APIs for this path.

#### Scenario: Sidebar thread select paints identity first

- **GIVEN** the user clicks a different thread in the conversation sidebar
- **WHEN** `handleSelectThread` runs
- **THEN** `selectWorkspace` and `setActiveThreadId` MUST be invoked before chrome setters such as `setActiveEngine`, `setHomeOpen`, `setAppMode`, `setActiveTab`, or `collapseRightPanel`
- **AND** chrome MUST be scheduled via `startTransition` (or an injected equivalent used by tests)

#### Scenario: Engine sync belongs to chrome, not identity

- **GIVEN** the selected thread has a known `engineSource`
- **WHEN** `commitThreadSelection` runs
- **THEN** `setActiveEngine` MUST NOT run inside `applyThreadSelectIdentity`
- **AND** `setActiveEngine` MUST run in the chrome phase after identity

#### Scenario: Workspace instance select uses the same commit helper

- **GIVEN** the user selects a workspace instance that maps to a thread
- **WHEN** `handleSelectWorkspaceInstance` runs
- **THEN** the same identity-then-chrome commit MUST be used
- **AND** requested right-panel collapse MUST stay in the chrome phase

### Requirement: Session select MUST NOT hydrate the thread list from disk

Selecting a thread MUST NOT force workspace thread-list disk or full-catalog hydration. List hydration remains allowed for workspace connect, sidebar expand, and archive/delete refresh.

#### Scenario: Sidebar thread select does not force list reload

- **GIVEN** the user clicks a thread in the conversation sidebar
- **WHEN** `handleSelectThread` runs
- **THEN** the system MUST NOT call `ensureWorkspaceThreadListLoaded`
- **AND** MUST NOT start a full-catalog / disk rescan as part of that click
