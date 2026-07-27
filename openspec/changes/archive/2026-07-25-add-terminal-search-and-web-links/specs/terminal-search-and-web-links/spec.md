## ADDED Requirements

### Requirement: Terminal buffer search

The Terminal SHALL let users open an in-panel search control with the platform find shortcut and navigate matches without sending input to the shell.

#### Scenario: User searches terminal output

- **WHEN** the focused Terminal receives Cmd+F or Ctrl+F
- **THEN** the search control opens and next/previous actions query the active xterm buffer

### Requirement: Safe terminal web links

The Terminal SHALL recognize web links and SHALL only open HTTP or HTTPS URLs through the desktop opener.

#### Scenario: A link uses an unsupported scheme

- **WHEN** a detected link does not use `http:` or `https:`
- **THEN** the application does not invoke the desktop opener

### Requirement: Existing Composer handoff remains available

The Terminal SHALL preserve exact selected-text handoff to Composer after search and link addons are enabled.

#### Scenario: User sends selected output

- **WHEN** the user invokes the selection context action
- **THEN** the exact current selection is inserted once into Composer
