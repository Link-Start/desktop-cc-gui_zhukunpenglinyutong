## ADDED Requirements

### Requirement: PR Form Prefill Source Awareness

The PR workflow SHALL treat form fields (title, body) as authoritative regardless of how they were filled.

#### Scenario: AI-generated title flows through unchanged

- **WHEN** the AI generator fills the title and body
- **AND** the user submits the Create PR workflow
- **THEN** the workflow SHALL use the current form values verbatim
- **AND** no automatic rewrite SHALL occur after submission

#### Scenario: Editable after AI fill

- **WHEN** the AI generator fills the title and body
- **THEN** the user SHALL remain able to edit either field freely
- **AND** subsequent edits SHALL be preserved on submit

#### Scenario: Write-back overwrites defaults

- **WHEN** the AI generator fills the title and body
- **AND** the form previously held pre-filled default values (merge commit title / empty body template)
- **THEN** the AI content SHALL replace the defaults unconditionally
- **AND** a 1.2s outline flash SHALL appear on both fields to make the change visible
