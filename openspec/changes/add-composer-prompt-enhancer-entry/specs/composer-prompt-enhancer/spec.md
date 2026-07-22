## ADDED Requirements

### Requirement: Discoverable Composer tool entry

The Composer prompt enhancer SHALL expose an accessible quick-action entry in the Composer tool popover in addition to the existing keyboard shortcut.

#### Scenario: Tool entry opens the existing enhancer dialog

- **WHEN** the user activates the prompt enhancer quick action from the Composer tool popover
- **THEN** the system SHALL invoke the same prompt enhancement action used by `Cmd+/` on macOS and `Ctrl+/` on Windows
- **AND** the system SHALL open the existing prompt enhancer dialog without starting enhancement automatically

#### Scenario: Running enhancement disables duplicate tool activation

- **WHEN** an enhancement request is already running
- **THEN** the prompt enhancer quick action SHALL be disabled

#### Scenario: Tool entry is accessible and localized

- **WHEN** assistive technology inspects the prompt enhancer quick action
- **THEN** the action SHALL expose a localized accessible name describing prompt enhancement

#### Scenario: Quick actions use a consistent icon surface

- **WHEN** the Composer tool popover shows prompt enhancement, output collapse, or rewind quick actions
- **THEN** those actions SHALL use the same icon-only button dimensions
- **AND** output collapse and rewind SHALL NOT render persistent surface labels
- **AND** their tooltip and accessible names SHALL remain available

#### Scenario: Tool popover uses compact vertical spacing

- **WHEN** the Composer tool popover is open
- **THEN** the quick-action row, primary menu rows, and separators SHALL use a compact vertical rhythm
- **AND** the 34px icon-only quick-action hit area SHALL remain unchanged

### Requirement: Supported prompt enhancer providers

The prompt enhancer SHALL offer only Claude Code and Codex as selectable enhancement providers.

#### Scenario: Provider dropdown excludes OpenCode

- **WHEN** the user opens the prompt enhancer provider dropdown
- **THEN** the system SHALL show Claude Code and Codex
- **AND** the system SHALL NOT show OpenCode

#### Scenario: Legacy OpenCode context uses a valid default

- **WHEN** prompt enhancement is opened while the current Composer provider is OpenCode
- **THEN** the prompt enhancer SHALL select Claude Code as the default provider

### Requirement: Light theme primary action contrast

The prompt enhancer SHALL keep primary actions recognizable and readable in the light theme across enabled and disabled states.

#### Scenario: Enabled primary action uses the light-theme accent

- **WHEN** a prompt enhancer primary action is enabled in the light theme
- **THEN** the action SHALL use the classic blue `#2563eb` treatment with readable foreground content

#### Scenario: Disabled primary action remains distinguishable

- **WHEN** a prompt enhancer primary action is disabled in the light theme
- **THEN** the action SHALL use a light-blue disabled treatment instead of a low-contrast gray block
- **AND** the action SHALL remain visibly disabled
