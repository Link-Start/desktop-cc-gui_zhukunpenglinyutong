## MODIFIED Requirements

### Requirement: Codex Sidebar Projection MUST Preserve Visible Session Continuity During Partial Refresh

Codex sidebar projection MUST preserve visible session continuity while staged catalog hydration is partial, capped, stale-discarded, or degraded.

#### Scenario: background hydration cannot blank visible Codex rows

- **WHEN** a background or related-workspace hydration returns incomplete Codex evidence
- **AND** the sidebar has last-good in-scope Codex rows
- **THEN** visible rows MUST remain until authoritative projection converges
- **AND** the surface MUST expose loading, partial, degraded, or continuity-preserved state

