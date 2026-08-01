## MODIFIED Requirements

### Requirement: Git Blame work MUST follow the first useful file viewport

Git Blame and workspace Git-derived changed-line markers MUST remain optional scheduled side channels. Ordinary file open MUST NOT request Git full diff for markers; enabling Git Blame MUST activate Blame and marker loading only after the initial document read has settled. Explicit upstream `highlightMarkers` MUST retain their existing priority and MUST NOT be reclassified as eager workspace Git work.

#### Scenario: ordinary file open does not load markers
- **WHEN** a user opens or activates a changed workspace text file without enabling Git Blame
- **THEN** the active document snapshot and CodeMirror viewport MUST render without requesting the file's Git full diff for changed-line markers
- **AND** the first useful viewport MUST NOT depend on Blame or marker work

#### Scenario: enabled blame is slow
- **WHEN** a user enables Git Blame and the backend response is delayed
- **THEN** the active document snapshot and CodeMirror viewport MUST remain visible and usable
- **AND** Blame and changed-line markers MAY appear independently only after their guarded async work completes

#### Scenario: enabled blame loads canonical changed-line markers
- **WHEN** a user enables Git Blame for a changed workspace text file after its initial document read settles
- **THEN** the system MUST request the canonical full diff and parse its added and modified line markers
- **AND** Blame failure MUST NOT prevent a successful marker result from appearing
- **AND** marker failure MUST NOT remove a successful Blame gutter

#### Scenario: disabling blame hides markers
- **WHEN** a user disables Git Blame while changed-line markers are visible or loading
- **THEN** the marker request MUST be cancelled or ignored and visible markers MUST be cleared
- **AND** ordinary file editing MUST remain available

#### Scenario: typing does not refetch full diff
- **WHEN** Git Blame is enabled and the user edits the current CodeMirror document
- **THEN** the system MUST NOT request a new full diff for each dirty snapshot or keystroke
- **AND** existing marker decorations MAY follow CodeMirror transactions until a clean guarded snapshot refresh is available

#### Scenario: blame completes for an obsolete file epoch
- **WHEN** Blame or marker work was requested for file A and the active file, snapshot version or render token changes before completion
- **THEN** the obsolete result MUST be cancelled or ignored
- **AND** it MUST NOT update file B or the current editor gutter

#### Scenario: added file keeps marker access when blame is unavailable
- **WHEN** Git Blame is enabled for an added or untracked file whose Blame request cannot resolve a committed history
- **THEN** a successful canonical full diff MUST still be allowed to produce changed-line markers
- **AND** the Blame error MUST remain isolated from marker rendering
