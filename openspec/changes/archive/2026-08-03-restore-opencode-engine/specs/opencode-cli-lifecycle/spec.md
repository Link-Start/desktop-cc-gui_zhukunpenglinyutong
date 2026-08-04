## ADDED Requirements

### Requirement: OpenCode CLI Doctor

The settings CLI validation surface SHALL provide an `opencode_doctor` command that verifies binary reachability, version, and default-model usability.

#### Scenario: doctor on a healthy install

- **WHEN** the user runs OpenCode doctor with a reachable binary
- **THEN** the report SHALL pass binary and version checks

#### Scenario: doctor detects broken default model

- **WHEN** the configured default model is not usable by the CLI (e.g. `Model not found`)
- **THEN** the report SHALL surface a dedicated check failure advising explicit model selection or config repair

### Requirement: OpenCode CLI Install And Upgrade

`cli_install_plan` / `cli_install_run` SHALL accept `engine: "opencode"` using the npm package `opencode-ai`; uninstall MUST NOT be offered.

#### Scenario: install plan for opencode

- **WHEN** the GUI requests an install plan for opencode
- **THEN** the plan SHALL use the npm-global strategy with package `opencode-ai`
- **AND** no uninstall action SHALL be exposed

### Requirement: OpenCode Settings Validation Tab

The settings CLI validation section SHALL expose an OpenCode tab with custom binary path, doctor, install, and upgrade controls, equivalent to the Grok tab.

#### Scenario: user saves a custom binary path

- **WHEN** the user saves a custom `opencodeBin` path
- **THEN** status detection and doctor SHALL use that path
