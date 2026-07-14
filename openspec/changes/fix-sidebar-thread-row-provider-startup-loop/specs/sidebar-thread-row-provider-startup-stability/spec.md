## ADDED Requirements

### Requirement: Sidebar thread rows MUST avoid startup anchor feedback loops

系统 SHALL 在 Sidebar thread rows 正常态使用无 Radix context 的 Floating tooltip，并 MUST NOT 为每个冷启动 row 常驻创建 Tooltip/Popover provider 与 anchor。

#### Scenario: Persisted thread rows hydrate on first launch
- **WHEN** multiple pinned and unpinned thread rows mount inside Sidebar ScrollArea under StrictMode
- **THEN** application MUST NOT report React #185 or maximum update depth
- **AND** normal rows MUST NOT mount Radix Tooltip/Popover provider or anchor state

#### Scenario: Thread name tooltip opens
- **WHEN** user hovers or keyboard-focuses a thread row
- **THEN** themed tooltip MUST open through a body portal with the requested placement and accessible description
- **AND** Escape MUST close the tooltip without moving trigger focus

#### Scenario: Delete confirmation opens
- **WHEN** delete confirmation state targets a thread row
- **THEN** controlled Popover and virtual anchor MAY mount for that row
- **AND** the thread row trigger DOM identity and focus MUST remain stable
- **AND** cancel and confirm behavior MUST remain functional
