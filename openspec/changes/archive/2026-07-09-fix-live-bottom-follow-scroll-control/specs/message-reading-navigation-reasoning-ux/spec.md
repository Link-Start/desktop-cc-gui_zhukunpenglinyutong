## ADDED Requirements

### Requirement: Message surface MUST expose floating top and bottom navigation

The message reading surface MUST provide direct top/bottom navigation without overloading the user-message anchor rail.

#### Scenario: floating control jumps to bottom

- **WHEN** the user activates the message surface back-to-bottom control
- **THEN** the viewport MUST scroll to the latest output at the true bottom of the scroll container
- **AND** normal live bottom-follow MAY resume according to the live follow rules

#### Scenario: floating control jumps to top

- **WHEN** the user activates the message surface back-to-top control
- **THEN** the viewport MUST scroll to the top of the message surface
- **AND** the underlying transcript order MUST remain unchanged

#### Scenario: anchor rail remains dedicated to message anchors

- **WHEN** the conversation renders user-message anchors and top/bottom navigation
- **THEN** the anchor rail MUST continue to represent message anchors
- **AND** top/bottom navigation SHOULD be exposed through the floating scroll control rather than a special anchor-rail bottom entry

### Requirement: Read tool markdown rendering MUST ignore shell line-number prefixes

Read tool output that includes shell-added `cat -n` style line numbers MUST render the underlying file content rather than treating the line-number gutter as Markdown content.

#### Scenario: numbered read output renders clean markdown

- **WHEN** a Read tool block receives content with `cat -n` line prefixes
- **THEN** the renderer MUST strip those prefixes before Markdown rendering
- **AND** the visible content MUST preserve the file text without the artificial shell numbering gutter
