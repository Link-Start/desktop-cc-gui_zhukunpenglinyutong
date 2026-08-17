## ADDED Requirements

### Requirement: Recovery click MUST yield paint before owner IPC

When Shared send state is `recovery-required`, the system MUST prefetch the recovery owner for the active workspace+thread. Primary recovery actions (auto / probe / stop / stop-and-rebuild / abandon) MUST yield one animation frame before starting their serial IPC ladder so the click can paint.

#### Scenario: recovery-required prefetches owner

- **GIVEN** Shared send state becomes `recovery-required` for a workspace+thread
- **WHEN** the recovery bar is shown
- **THEN** the system MUST start `sharedSessionV2TurnState` (or the equivalent owner lookup) before the user clicks 自动处理

#### Scenario: Auto uses prefetch once then looks up fresh

- **GIVEN** a prefetched owner promise exists for the current workspace+thread
- **WHEN** the user clicks 自动处理
- **THEN** the first owner resolution MAY reuse that promise
- **AND** the second owner lookup after recover/interrupt MUST NOT reuse the same cache entry
- **AND** recover / interrupt / rebuild MUST invalidate the prefetch cache
