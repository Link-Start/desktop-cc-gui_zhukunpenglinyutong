# windows-titlebar-control-safe-zone Specification

## Purpose
TBD - created by archiving change fix-windows-titlebar-controls-overlap. Update Purpose after archive.
## Requirements
### Requirement: Windows Titlebar Controls MUST Own A Reserved Right-Side Safe Zone

Windows desktop titlebar chrome MUST prevent custom window controls from overlapping floating titlebar actions.

#### Scenario: window controls remain far right

- **WHEN** the app renders on Windows desktop
- **THEN** minimize, maximize/restore, and close controls MUST remain grouped at the far-right titlebar edge
- **AND** that group MUST own a stable reserved width for layout avoidance

#### Scenario: swapped floating sidebar toggle avoids window controls

- **GIVEN** the app is in desktop layout-swapped mode
- **AND** the sidebar is collapsed such that a floating titlebar sidebar restore control is shown on the right side
- **AND** the app renders on Windows desktop
- **WHEN** titlebar controls are laid out
- **THEN** the floating sidebar restore control MUST be offset left of the Windows window controls safe zone
- **AND** it MUST NOT share the same raw right anchor as the window controls group
- **AND** a visible gap MUST remain between the two control groups

#### Scenario: non-Windows titlebar placement remains unchanged

- **WHEN** the app renders on macOS or non-Windows desktop
- **THEN** the Windows reserved right-side safe zone MUST NOT move macOS traffic-light inset handling
- **AND** existing non-Windows floating sidebar toggle placement MUST remain unchanged

#### Scenario: main topbar content does not invade the Windows safe zone

- **WHEN** Windows desktop topbar content is rendered near the right edge
- **THEN** main topbar actions and session tabs MUST continue to respect the window-controls safe zone
- **AND** titlebar overlay controls MUST remain clickable with `no-drag` semantics

### Requirement: Windows Titlebar Drag MUST Start On Intentional Pointer Movement

Windows frameless titlebar dragging MUST feel attached to the user's pointer movement while preserving fullscreen and interactive-control safety.

#### Scenario: first movement starts guarded drag
- **WHEN** the app renders on Windows desktop
- **AND** the user presses the primary mouse button in a valid titlebar drag region
- **AND** the pointer moves beyond the small drag threshold while still pressed
- **THEN** the app MUST call the Tauri `isFullscreen()` guard and then `startDragging()` without waiting for a fixed human-visible delay

#### Scenario: click and controls do not start drag
- **WHEN** the user clicks without moving, clicks an element marked `data-tauri-drag-region="false"`, or clicks an interactive control in the titlebar
- **THEN** the app MUST NOT start a window drag

#### Scenario: fullscreen safety remains guarded
- **WHEN** a valid Windows titlebar drag gesture is detected
- **THEN** `startDragging()` MUST NOT run while the window is fullscreen
- **AND** the double-click maximize/fullscreen recovery path MUST remain separate from normal drag initiation

