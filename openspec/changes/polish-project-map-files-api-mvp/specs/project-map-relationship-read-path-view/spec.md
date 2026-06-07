## ADDED Requirements

### Requirement: Read Path presents a layered reading route
The Relationship Read Path view SHALL present a selected file as a concise reading route rather than as raw relationship groups or context-pack lists.

#### Scenario: User opens Read Path for a selected file
- **WHEN** the selected file has relationship/context data
- **THEN** the view presents route steps grouped by reading intent such as entry, current file, key dependencies, and verification
- **AND** each step explains why the user should read it.

#### Scenario: Route data is sparse
- **WHEN** the selected file does not have enough relationship/context data to build a route
- **THEN** the Read Path view shows a concise empty state instead of rendering low-value raw lists.

### Requirement: Read Path supports comprehension-oriented review
The Relationship Read Path view SHALL help the user decide whether they have understood the selected file by showing checklist questions and compact route signals.

#### Scenario: User reviews the route
- **WHEN** route steps are visible
- **THEN** the side panel shows comprehension questions about entry points, responsibility boundaries, data flow, impact, and verification.

#### Scenario: Existing repair/read-error artifacts exist
- **WHEN** the relationship snapshot contains repair issues or read errors
- **THEN** the Read Path view SHALL NOT render them as a persistent bottom strip across tabs.
