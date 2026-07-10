## ADDED Requirements

### Requirement: Live bottom-follow MUST react to rendered content growth

When live assistant text is delivered through a path that does not mutate the root conversation item array for every delta, the message surface MUST still keep bottom-follow behavior tied to actual rendered content growth.

#### Scenario: streaming height growth keeps viewport pinned during follow window

- **WHEN** a conversation is actively streaming
- **AND** the message timeline's rendered height grows
- **AND** bottom-follow is currently allowed by the streaming follow window
- **THEN** the viewport MUST remain at the true bottom of the scroll container
- **AND** the behavior MUST NOT depend solely on reducer item identity or `scrollKey` changes

#### Scenario: direct bottom scroll includes container padding

- **WHEN** the user or live follow behavior scrolls to the latest output
- **THEN** the scroll target MUST be the scroll container's true bottom
- **AND** bottom padding MUST NOT remain below the viewport solely because a bottom sentinel used `scrollIntoView`

#### Scenario: deliberate scroll-away releases bottom-follow

- **WHEN** the user intentionally scrolls upward during a live conversation
- **THEN** automatic bottom-follow MUST pause
- **AND** later rendered height growth MUST NOT force the viewport back to bottom until a follow window or explicit user action allows it
