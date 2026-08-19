## ADDED Requirements

### Requirement: DSH occupancy uses contextPressure, not billed tokenUsage
For engine `dsh`, the Composer context indicator SHALL compute occupancy from host `contextPressure`: numerator `projectedTokens` if present otherwise `pressureTokens`, denominator `contextWindow`. Billed `tokenUsage` buckets MUST NOT be used as the occupancy numerator. The indicator MUST render only when both a numerator and a denominator are known.

#### Scenario: Occupancy ring matches the host meter
- **WHEN** mux delivers `contextPressure` with `projectedTokens = 209000` and `contextWindow = 262000`
- **THEN** the DSH indicator MUST show about `80%` and `~209K / 262K`
- **AND** MUST NOT substitute `tokenUsage.uncachedInputTokens + outputTokens` as the used count

#### Scenario: Incomplete pressure stays empty
- **WHEN** only billed `tokenUsage` has arrived and `contextWindow` or the pressure numerator is absent
- **THEN** the indicator MUST NOT paint `0%` as a real occupancy
- **AND** MAY show a waiting / empty ring

#### Scenario: tokenUsage frames do not wipe occupancy
- **WHEN** a later `tokenUsage` projection arrives after `contextPressure`
- **THEN** billed buckets MAY update
- **AND** `contextUsedTokens` / `modelContextWindow` / category rows MUST remain

### Requirement: DSH hover shows heuristic contextBreakdown rows
The DSH occupancy hover card SHALL list three approximate composition rows from `contextBreakdown`: system prompt, tools, and conversation messages. Figures MUST be presented as estimates (for example with a leading `~`). The three rows MUST NOT be required to sum to the occupancy numerator.

#### Scenario: Three-row hover
- **WHEN** `contextBreakdown` is `{ systemTokens: 1500, toolsTokens: 6400, messageTokens: 196000 }`
- **THEN** the hover card MUST show those three labeled rows with approximate token counts
- **AND** MUST NOT treat their sum as the occupancy total

#### Scenario: Claude and Codex cards stay unchanged
- **WHEN** the active engine is `claude` or `codex`
- **THEN** the existing Claude header-only card and Codex dual-view compaction controls MUST keep their current behavior

### Requirement: History restores occupancy from projections.values
Opening a DSH session SHALL seed occupancy from history `projections.values.contextPressure` and `contextBreakdown` when present, with freshness `restored`.

#### Scenario: Reopen restores the ring
- **WHEN** the history page has `contextPressure.contextWindow` and a pressure / projected numerator
- **THEN** the DSH indicator MUST show occupancy without waiting for a new mux frame
