# dynamic-project-governance-evidence Spec Delta

## MODIFIED Requirements

### Requirement: Governance Evidence UI MUST Group Evidence By Actionability

The StatusPanel governance evidence surface MUST group evidence into action-oriented groups: `needs_action`, `watch`, and `passed`. The UI MUST make the needs-action count visible before detailed evidence rows. The surface MUST be hidden by default and only rendered when the user explicitly opts in via the client UI visibility control `bottomActivity.governanceEvidence`; when the control is off, the UI MUST NOT read workspace governance artifacts and MUST NOT render the evidence section.

#### Scenario: evidence surface is opt-in by default

- **WHEN** the user has never enabled the `bottomActivity.governanceEvidence` visibility control
- **THEN** the 「结果」tab MUST NOT render the governance evidence section
- **AND** the client MUST NOT issue workspace file reads for governance evidence collection

#### Scenario: opting in restores the grouped evidence surface

- **WHEN** the user enables the `bottomActivity.governanceEvidence` visibility control in settings
- **THEN** the governance evidence section MUST render with the actionability grouping behavior below
- **AND** the visibility choice MUST persist across restarts via the client UI visibility store

#### Scenario: non-pass evidence appears before pass evidence

- **WHEN** the evidence snapshot contains both healthy pass rows and degraded rows
- **THEN** degraded or failing rows MUST appear in the needs-action or watch group before passed rows

#### Scenario: passed evidence is collapsed by default

- **WHEN** the evidence snapshot contains only pass rows or many pass rows
- **THEN** the passed group MUST be collapsed or summarized by default
- **AND** the user MUST still be able to inspect the passed evidence details

#### Scenario: non-pass row exposes impact and action

- **WHEN** a governance evidence row is rendered outside the passed group
- **THEN** the row MUST expose impact, source, and a suggested action or explicit no-action rationale

#### Scenario: config guide is secondary to detected evidence

- **WHEN** no governance config exists but the project has dynamically detected evidence
- **THEN** the UI MAY show a subtle config guide or override affordance
- **AND** it MUST still render the detected evidence groups
