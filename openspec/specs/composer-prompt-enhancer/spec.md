# composer-prompt-enhancer Specification

## Purpose
TBD - created by archiving change add-prompt-enhancer-manual-provider-timeout. Update Purpose after archive.
## Requirements
### Requirement: Prompt enhancer dialog manual run

The Composer prompt enhancer SHALL open as a configuration and review dialog without starting an enhancement request automatically.

#### Scenario: Opening dialog does not run enhancement

- **WHEN** the user triggers prompt enhancement from Composer
- **THEN** the system SHALL open the prompt enhancer dialog with the current draft as the original prompt
- **AND** the system SHALL NOT call the engine runtime until the user explicitly starts enhancement

#### Scenario: Empty composer draft does not open runnable enhancement

- **WHEN** the user triggers prompt enhancement with an empty Composer draft
- **THEN** the system SHALL NOT start an enhancement request

### Requirement: Per-run enhancer engine selection

The prompt enhancer dialog SHALL allow the user to select the engine used for the next prompt enhancement run.

#### Scenario: User selected engine is used for enhancement

- **WHEN** the user selects an enhancer engine and starts enhancement
- **THEN** the system SHALL call the engine runtime with the selected engine
- **AND** the selected engine SHALL apply only to the current prompt enhancement run

#### Scenario: Non-Claude selected engine fails without Claude fallback

- **WHEN** the user selects a non-Claude engine and that engine fails
- **THEN** the system SHALL show a traceable failure for that selected engine
- **AND** the system SHALL NOT silently retry through Claude fallback

### Requirement: Per-run enhancer timeout control

The prompt enhancer dialog SHALL allow the user to configure the timeout used for the next prompt enhancement run.

#### Scenario: User configured timeout is applied

- **WHEN** the user enters a valid timeout and starts enhancement
- **THEN** the system SHALL apply that timeout to the enhancement request

#### Scenario: Invalid timeout is sanitized

- **WHEN** the user enters an invalid or out-of-range timeout
- **THEN** the system SHALL normalize the value to a safe bounded timeout before running

### Requirement: Per-run enhancer model selection

The prompt enhancer dialog SHALL allow the user to select a model for the selected enhancer engine when models are available.

#### Scenario: Engine model list is shown

- **WHEN** the user selects an enhancer engine with available models
- **THEN** the dialog SHALL show a model selector populated from that engine model list

#### Scenario: Selected model is used for enhancement

- **WHEN** the user selects an engine model and starts enhancement
- **THEN** the system SHALL call the engine runtime with that selected model

#### Scenario: Engine without models can still run

- **WHEN** the selected enhancer engine has no available models
- **THEN** the dialog SHALL allow the model selection to be empty
- **AND** the system SHALL call the engine runtime with no explicit model

### Requirement: Enhancement result adoption remains explicit

The prompt enhancer SHALL require explicit user action before replacing Composer content with the enhanced prompt.

#### Scenario: Successful enhancement can be adopted

- **WHEN** an enhancement run succeeds and returns normalized enhanced text
- **THEN** the dialog SHALL enable the use-enhanced action
- **AND** activating that action SHALL replace the Composer draft with the enhanced prompt

#### Scenario: Keeping original does not mutate composer draft

- **WHEN** the user keeps the original prompt or closes the dialog
- **THEN** the Composer draft SHALL remain unchanged

### Requirement: Prompt enhancer run lifecycle safety

The prompt enhancer SHALL prevent duplicate concurrent runs and ignore stale results after closure or a newer run.

#### Scenario: Running state blocks duplicate execution

- **WHEN** an enhancement request is already running
- **THEN** the dialog SHALL prevent starting another enhancement request from the same dialog state

#### Scenario: Closed dialog invalidates in-flight result

- **WHEN** the user closes the dialog while an enhancement request is in flight
- **THEN** the system SHALL ignore the eventual result from that stale request

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

