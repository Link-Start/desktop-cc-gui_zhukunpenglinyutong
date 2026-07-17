## ADDED Requirements

### Requirement: Git Blame MUST stay outside editor interaction hot paths

Active blame annotations MUST NOT introduce backend work or full-document React publication into urgent editor interactions.

#### Scenario: user interacts with a blamed editor
- **WHEN** the user types, moves the cursor, changes selection, hovers a line or scrolls
- **THEN** the editor MUST NOT issue a new blame command for each interaction
- **AND** visible typing and cursor feedback MUST remain owned by the local CodeMirror session

#### Scenario: blame payload arrives during typing
- **WHEN** blame data completes while the user is typing
- **THEN** the editor MUST update blame through a bounded CodeMirror effect or equivalent local channel
- **AND** it MUST NOT remount the editor or require an app-wide document snapshot publication
