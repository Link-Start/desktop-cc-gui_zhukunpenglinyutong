## ADDED Requirements

### Requirement: File Content Context Menu MUST Expose Executable Shortcut Hints

The file content context menu MUST display platform-aware shortcut hints for its actionable leaf commands, while submenu triggers and unavailable commands MUST NOT advertise dead shortcuts.

#### Scenario: Edit menu exposes shortcut hints

- **GIVEN** an editable file is rendered in edit mode
- **WHEN** 用户打开 file content context menu
- **THEN** available clipboard、note capture、Git leaf、reveal、Canvas、selection、navigation、preview 与 save actions MUST display their executable shortcut hints
- **AND** `Git 操作` submenu trigger MUST remain without a shortcut hint

#### Scenario: Preview menu exposes mode-appropriate shortcut hints

- **GIVEN** a preview can return to edit mode
- **WHEN** 用户打开 file content context menu
- **THEN** Edit MUST display the shared Preview/Edit toggle shortcut
- **AND** editor-only unavailable actions MUST remain omitted

#### Scenario: Disabled command is not triggered from keyboard

- **WHEN** a menu action is disabled or unavailable because of selection、dirty state、Git scope、render mode or missing callback
- **THEN** its fixed shortcut MUST be a no-op
- **AND** it MUST NOT invoke a stale callback from a previous file or mode
