## ADDED Requirements

### Requirement: Message anchor rail SHALL provide a direct bottom jump

The message reading navigation rail SHALL provide a direct way to return to the latest message area when multiple user-message anchors are visible.

#### Scenario: bottom jump appears below anchor dashes
- **GIVEN** the conversation has enough user messages to render the message anchor rail
- **WHEN** the rail is visible
- **THEN** the rail SHALL render a direct bottom jump affordance below the anchor dashes
- **AND** the affordance SHALL expose a localized accessible label

#### Scenario: bottom jump returns to latest content
- **GIVEN** the user has scrolled away from the latest message area
- **WHEN** the user activates the bottom jump affordance
- **THEN** the message viewport SHALL scroll to the bottom sentinel
- **AND** live auto-follow SHALL be allowed to resume for later output
- **AND** canonical transcript order SHALL remain unchanged

#### Scenario: expanded anchor panel does not block bottom jump
- **GIVEN** the conversation has many user-message anchors
- **WHEN** the anchor outline panel is expanded
- **THEN** the panel SHALL NOT intercept pointer access to the bottom jump affordance
- **AND** the bottom jump affordance SHALL remain visually aligned with the collapsed anchor rail

