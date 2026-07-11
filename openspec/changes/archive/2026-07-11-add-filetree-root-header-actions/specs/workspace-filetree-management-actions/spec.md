## MODIFIED Requirements

### Requirement: File Tree SHALL Provide Workspace File Management Actions

The system SHALL expose consistent file and folder management actions from the workspace file tree,
including Copy, Paste, Rename, Duplicate, Create File, Create Folder, Move to Trash, Copy Path,
Reveal, and root-level header shortcuts for Create File, Create Folder, and Refresh.

#### Scenario: Root header exposes root creation and refresh actions

- **WHEN** the workspace file tree renders its sticky root header
- **THEN** the left side SHALL display the active workspace root label normalized to uppercase
- **AND** the right side SHALL expose icon-only actions for New File, New Folder, and Refresh
- **AND** the primary workspace file tree SHALL render only those three root header actions unless an explicit non-primary surface enables optional detached explorer or Spec Hub actions
- **AND** these actions SHALL use accessible labels from existing file-tree i18n copy
- **AND** the root header visual treatment SHALL remain minimal, token-based, use compact low-stroke icons, use a transparent background, and separate from the file list with a light bottom divider
- **AND** the header MUST NOT expose Move to Trash as a root-level action

#### Scenario: Root header actions reuse existing root operation chain

- **WHEN** the user selects New File from the root header
- **THEN** the existing new-file prompt SHALL open with the workspace root as parent
- **WHEN** the user selects New Folder from the root header
- **THEN** the existing new-folder prompt SHALL open with the workspace root as parent
- **WHEN** the user selects Refresh from the root header
- **THEN** the file tree SHALL clear lazy directory cache and invoke the existing refresh callback
