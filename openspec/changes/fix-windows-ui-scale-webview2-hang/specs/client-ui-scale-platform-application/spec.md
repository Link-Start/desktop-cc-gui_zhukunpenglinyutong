## ADDED Requirements

### Requirement: UI scale application is platform-specific

The desktop client MUST apply the persisted `uiScale` setting in a platform-specific way so that Windows WebView2 is never asked to set a non-identity native zoom factor for application UI scale.

#### Scenario: Windows applies CSS page scale, layout fill, and pins native zoom to 1

- **WHEN** the renderer platform is `windows`
- **AND** the clamped `uiScale` is any value in the supported range (including values other than `1`)
- **THEN** the client MUST apply page scale via CSS `transform: scale(uiScale)` on `<body>` (not on `<html>`)
- **AND** when `uiScale ≠ 1`, the client MUST expand body layout width and height to `100/uiScale %` with `position: fixed; top/left: 0; transform-origin: 0 0` so the scaled paint box fills the viewport (no letterbox)
- **AND** the client MUST NOT rely on CSS `zoom` alone for shell fill (WebView2 may keep the shrunk border box and letterbox)
- **AND** when `uiScale === 1`, the client MUST clear those layout width/height/transform/position compensations
- **AND** the client MUST clear any residual CSS zoom / transform / fill left on `<html>` from older builds
- **AND** if the Tauri webview zoom API is available, the client MUST call native zoom with factor `1` only
- **AND** the client MUST NOT call native zoom with the non-1 `uiScale` value

#### Scenario: macOS applies native zoom at uiScale

- **WHEN** the renderer platform is `macos`
- **AND** the clamped `uiScale` is a supported value other than `1`
- **THEN** the client MUST call native webview zoom with that `uiScale`
- **AND** the client MUST clear any CSS zoom left on `<html>` and `<body>` from other platforms
- **AND** the client MUST clear any CSS zoom layout width/height compensation on both elements (Mac MUST NOT keep Windows letterbox fill styles)

#### Scenario: Linux applies native zoom at uiScale by default

- **WHEN** the renderer platform is `linux`
- **AND** the clamped `uiScale` is a supported value other than `1`
- **THEN** the client MUST call native webview zoom with that `uiScale` (WebKitGTK path)
- **AND** the client MUST clear CSS zoom on `<html>` and `<body>`
- **AND** the client MUST clear any CSS zoom layout width/height compensation on both
- **AND** the client MUST NOT force CSS-only zoom solely because Windows uses CSS

#### Scenario: Unknown or non-Tauri preview uses CSS scale safely

- **WHEN** the renderer platform is `unknown` or native webview zoom is unavailable
- **THEN** the client MUST still apply CSS page scale for the clamped `uiScale` (same body target as Windows when root is `documentElement`)
- **AND** the client MUST apply the same layout fill rule as Windows (`100/uiScale %` when scale ≠ 1)
- **AND** missing Tauri metadata MUST NOT throw into a React error boundary

#### Scenario: User uiScale value is not silently rewritten

- **WHEN** applying UI scale on any platform
- **THEN** the client MUST NOT persist a different `uiScale` solely as a workaround for platform zoom bugs
- **AND** a stored `uiScale` of `0.8` MUST remain `0.8` in settings after a successful apply
