## MODIFIED Requirements

### Requirement: Theme and Visual Consistency

The panel SHALL follow application theme variables and SHALL present its title layer as integrated, non-clipping window chrome.

#### Scenario: Dark theme

- **WHEN** application is in dark mode
- **THEN** panel and diff colors follow dark theme tokens with readable contrast
- **AND** the title layer SHALL use subtle surface separation and a perceptible 1px bottom divider backed by a globally defined theme token
- **AND** it SHALL NOT appear as an inset rounded card

#### Scenario: Light theme

- **WHEN** application is in light mode
- **THEN** panel and diff colors follow light theme tokens with readable contrast
- **AND** the title layer SHALL remain visually distinct without relying on dark-theme-only colors or an ambient card shadow
- **AND** the 1px bottom divider SHALL remain perceptible against the light title surface

#### Scenario: Title layer keeps interactive overlays visible

- **WHEN** user opens a project or repository picker from the title layer
- **THEN** the picker dropdown SHALL remain fully visible outside the title layer
- **AND** the title layer SHALL NOT clip toolbar actions or control focus indicators
- **AND** focusing one control SHALL NOT add a frame around the entire title layer

#### Scenario: Title layer remains stable across panel states and widths

- **WHEN** Git History renders its normal state, repository empty state, or a narrow viewport
- **THEN** the title layer SHALL remain full-width and zero-radius with a consistent integrated chrome treatment
- **AND** existing toolbar wrapping SHALL remain available without introducing horizontal overflow

#### Scenario: Title layer uses compact vertical density

- **WHEN** Git History renders the title layer on a viewport that fits the toolbar in one row
- **THEN** decorative vertical padding SHALL be minimized so the title layer height is primarily determined by its interactive controls
- **AND** project/repository pickers, action chips, and close action SHALL retain their existing control height and pointer target
- **AND** the bottom divider SHALL remain visible without adding a second vertical spacer
