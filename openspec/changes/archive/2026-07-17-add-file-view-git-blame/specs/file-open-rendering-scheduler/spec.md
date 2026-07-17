## ADDED Requirements

### Requirement: Git Blame work MUST follow the first useful file viewport

Git Blame MUST remain an optional scheduled side channel and MUST NOT join the document read or first useful viewport critical path.

#### Scenario: enabled blame is slow
- **WHEN** a user enables Git Blame and the backend response is delayed
- **THEN** the active document snapshot and CodeMirror viewport MUST remain visible and usable
- **AND** blame MAY appear only after its guarded async work completes

#### Scenario: blame completes for an obsolete file epoch
- **WHEN** blame was requested for file A and the active file, snapshot version or render token changes before completion
- **THEN** the result MUST be cancelled or ignored
- **AND** it MUST NOT update file B or the current editor gutter
