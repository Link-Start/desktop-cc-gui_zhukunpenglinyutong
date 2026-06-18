## ADDED Requirements

### Requirement: Realtime Evidence MUST Measure Codex Post-Ack First Delta Wait
Realtime performance evidence MUST distinguish Codex post-ack first-delta wait from frontend turn-start acknowledgement and renderer visible text latency when timing data is available.

#### Scenario: post-ack first-delta metric is reported
- **WHEN** a Codex turn has measured `turn/start` response acknowledgement and measured first text delta ingress timing
- **THEN** runtime performance reports MUST include a measured `codexPostAckFirstDeltaP95`
- **AND** the report MUST preserve `turnStartAckLatencyP95` and `firstDeltaLatencyP95` as separate metrics

#### Scenario: post-ack residual guides next action
- **WHEN** post-ack first-delta wait is high while visible lag and reducer amplification are healthy
- **THEN** the report MUST identify the next investigation area as backend/provider/startup before renderer optimization
