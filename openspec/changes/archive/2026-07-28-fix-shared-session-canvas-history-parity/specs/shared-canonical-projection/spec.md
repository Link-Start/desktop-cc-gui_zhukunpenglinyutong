## ADDED Requirements

### Requirement: Canonical and Legacy dual-read MUST converge without transcript loss

While Shared canonical final snapshots do not contain every presentation transcript fact, the Shared history DataSource MUST use Legacy presentation snapshot order as the transcript base and merge canonical facts through the shared Conversation assembler. Canonical frozen identity MUST remain authoritative, while presentation-only reasoning and tool facts MUST remain visible and MUST NOT be written back as fabricated canonical facts.

#### Scenario: canonical assistant overlays legacy assistant identity
- **WHEN** Legacy snapshot and canonical projection contain equivalent assistant finals with different item IDs
- **THEN** dual-read convergence MUST render one assistant final
- **AND** that final MUST carry the canonical `TurnExecutionSnapshot`

#### Scenario: canonical projection lacks legacy reasoning
- **WHEN** Legacy snapshot contains reasoning for a Turn and canonical projection contains only user and assistant text for that Turn
- **THEN** the converged history MUST retain the Legacy reasoning in its original order
- **AND** MUST retain canonical target identity on the assistant final

#### Scenario: shared history remains isolated from native files
- **WHEN** Shared canonical and Legacy sources are converged
- **THEN** the loader MUST read only Shared storage sources
- **AND** MUST NOT read Claude or Codex Native history files
