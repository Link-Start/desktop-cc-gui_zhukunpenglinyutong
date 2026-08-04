# conversation-canvas-scroll-ownership Specification

## Purpose

共同消息幕布滚动所有权：单一决策面决定何时贴底、何时 free、何时允许程序写 scrollTop。

## Requirements

### Requirement: Viewport mode is the single semantic state for canvas scroll ownership

The messages canvas scroll ownership layer MUST represent viewport policy as exactly one of: `stick-bottom`, `free`, `forced-bottom`, `jump-anchor`, `history-head`.

#### Scenario: mode maps to a single owner

- **WHEN** the authority state is `stick-bottom`
- **THEN** the scroll owner MUST be `stick`
- **WHEN** the authority state is `free`
- **THEN** the scroll owner MUST be `none` and MUST NOT issue a write ticket for continuous pin

### Requirement: True bottom uses a one-pixel epsilon

Engineering completion for “at bottom” MUST use `distanceToBottom <= 1` CSS pixel. The legacy near-bottom threshold of 120px MUST only re-arm continuous follow heuristics and MUST NOT certify true-bottom completion after turn settle.

#### Scenario: true bottom predicate

- **WHEN** `scrollHeight - clientHeight - scrollTop` is less than or equal to 1
- **THEN** `isAtTrueBottom` MUST be true
- **WHEN** that distance is greater than 1
- **THEN** `isAtTrueBottom` MUST be false even if the distance is less than 120

### Requirement: Forced bottom retires on geometry stability or safety timeout

`forced-bottom` MUST remain active until geometry is stable and the viewport is at true bottom, or until a safety timeout elapses. A fixed multi-second settle window alone MUST NOT be the sole correctness condition for leaving forced mode.

#### Scenario: stable retirement

- **WHEN** mode is `forced-bottom`
- **AND** scroll height has been unchanged for the configured stable window with enough samples
- **AND** no pending virtualizer remeasure or desired phase handoff is open
- **AND** the viewport is at true bottom
- **THEN** the authority MUST retire forced mode according to live auto-follow policy

#### Scenario: safety timeout retirement

- **WHEN** mode is `forced-bottom` and the safety timeout elapses before stability
- **THEN** the authority MUST request a final bottom pin
- **AND** MUST emit reason code `settle-timeout-short-of-bottom`
- **AND** MUST then retire forced mode

### Requirement: Explicit upward user scroll interrupts forced mode

During `forced-bottom`, only explicit user upward scroll intent MAY interrupt to `free`. Noise, programmatic applied-ticket echoes, and geometry-proven browser clamps MUST NOT interrupt forced mode.

#### Scenario: explicit wheel up interrupts forced

- **WHEN** mode is `forced-bottom`
- **AND** a wheel event has `deltaY` negative with absolute value at least the configured minimum
- **THEN** mode MUST become `free`
- **AND** reason code MUST be `forced-interrupted-by-user-scroll`

#### Scenario: micro delta does not interrupt forced

- **WHEN** mode is `forced-bottom`
- **AND** a wheel event has absolute `deltaY` below the configured minimum
- **THEN** mode MUST remain `forced-bottom`

### Requirement: Geometry growth while forced or stick requests pin

While viewport mode is `forced-bottom` or `stick-bottom`, geometry growth MUST request an instant bottom pin (subject to write-rate limits).

#### Scenario: content grow under forced requests pin

- **WHEN** mode is `forced-bottom` or `stick-bottom`
- **AND** a geometry delta increases max scroll range or changes client height
- **THEN** the authority MUST request an instant bottom pin

### Requirement: Live auto-follow off lands free at true bottom after forced retire

When forced mode retires, the resulting mode MUST depend on live auto-follow, and free retirement MUST preserve true-bottom completion.

#### Scenario: live auto-follow off after forced retire

- **WHEN** forced mode retires and live auto-follow is disabled
- **THEN** mode MUST be `free`
- **AND** retirement MUST only complete when true bottom was achieved or a final safety pin was applied

#### Scenario: live auto-follow on after forced retire

- **WHEN** forced mode retires and live auto-follow is enabled
- **THEN** mode MUST become `stick-bottom` unless explicit user scroll already owns free
