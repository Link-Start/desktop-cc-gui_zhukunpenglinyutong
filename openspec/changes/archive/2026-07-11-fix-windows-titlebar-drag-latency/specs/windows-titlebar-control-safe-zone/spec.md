## ADDED Requirements

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
