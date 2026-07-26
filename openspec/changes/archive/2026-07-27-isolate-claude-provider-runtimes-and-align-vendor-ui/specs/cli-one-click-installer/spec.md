## ADDED Requirements

### Requirement: Vendor CLI Lifecycle Header MUST Remain Collision-Free

Vendor CLI lifecycle header MUST preserve readable, reachable proxy/version/update/refresh actions across supported viewport widths and localized copy lengths.

#### Scenario: current version and proxy status coexist

- **WHEN** proxy status、local CLI version、latest status 与 refresh action 同时可见
- **THEN** action group MUST use normal flow layout and wrap when horizontal space is insufficient
- **AND** no badge or button MAY overlap provider content、header title or another action

#### Scenario: update is available

- **WHEN** local version、latest version、update button 与 refresh button 同时可见
- **THEN** all actions MUST remain reachable and retain their accessible names
- **AND** update/latest badges MUST NOT be clipped by an overflow container

#### Scenario: narrow settings viewport

- **WHEN** vendor settings content width cannot contain title and lifecycle actions on one row
- **THEN** header MUST move actions to a separate row or column within normal document flow
- **AND** action alignment MUST remain stable in light and dark themes

### Requirement: CLI Version Status MUST Reject Shell Startup Noise

CLI version status MUST distinguish canonical CLI version output from login shell startup banners and MUST distinguish unknown latest status from confirmed latest status.

#### Scenario: proxy banner precedes Claude version

- **WHEN** interactive login shell output contains proxy notice、diagnostic copy、binary path 与 canonical Claude version
- **THEN** backend MUST select only the canonical Claude version line
- **AND** proxy URL or IP address MUST NOT become `localVersion`

#### Scenario: latest version probe is unknown

- **WHEN** local version is known but registry latest version is unavailable or invalid
- **THEN** header MUST show the local version without “已是最新”
- **AND** update action MUST remain hidden

#### Scenario: latest version is confirmed

- **WHEN** local version and latest version are both valid semver
- **THEN** header MUST show update target/action only when latest is greater than local
- **AND** header MAY show “已是最新” only when no greater version exists
