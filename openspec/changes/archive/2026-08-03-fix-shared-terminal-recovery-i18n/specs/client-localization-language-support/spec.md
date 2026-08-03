## ADDED Requirements

### Requirement: Shared Send Protocol Vocabulary MUST Be Locale-Complete

The `sharedSend` localization namespace MUST provide locale-specific strings for Shared send
states, recovery actions, degraded-context actions, projection modes, omission
categories/reasons/dispositions, outcome labels, and token-detail labels. Every supported locale
module MUST expose the same keys and interpolation placeholders.

#### Scenario: locale modules keep namespace parity

- **WHEN** a Shared send localization key is added or changed
- **THEN** every supported `sharedSend` locale module MUST expose the same key
- **AND** interpolation placeholders MUST match the English source namespace

#### Scenario: Chinese UI does not leak known protocol labels

- **WHEN** the active locale is `zh` or `zh-TW`
- **THEN** known Shared send protocol labels and actions MUST render in Chinese
- **AND** `Probe`, `Binding`, `Attempt`, `Target`, `portable-transcript`, and known disposition values MUST NOT be used as the primary visible copy
