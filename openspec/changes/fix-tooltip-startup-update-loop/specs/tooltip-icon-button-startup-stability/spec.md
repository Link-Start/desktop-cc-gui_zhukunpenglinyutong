## ADDED Requirements

### Requirement: Tooltip icon buttons MUST remain stable during AppShell startup

系统 SHALL 使用 native button 与无 Radix context 的 Floating UI popup，MUST NOT 在 TooltipIconButton 链路挂载 Radix Tooltip `PopperAnchor / SlotClone`，并 MUST NOT 在 AppShell/sidebar mount、StrictMode replay 或 layout host 变化时进入 nested update loop。

#### Scenario: Sidebar collapse button mounts during startup
- **WHEN** AppShell mounts `SidebarCollapseButton` inside React StrictMode
- **THEN** trigger MUST render as one native button without nested buttons
- **AND** application MUST NOT report `Maximum update depth exceeded`

#### Scenario: Sidebar toggle changes layout host
- **WHEN** sidebar collapse trigger opens its tooltip and is repeatedly rerendered or remounted between layout hosts
- **THEN** tooltip state MUST settle without recursive updates
- **AND** button events and accessible label MUST remain functional

#### Scenario: Icon tooltip opens near a viewport edge
- **WHEN** TooltipIconButton opens with side、align、offset 或 custom class configuration
- **THEN** popup MUST preserve the existing themed visual surface and body portal
- **AND** positioning MUST support offset、flip、shift and automatic scroll/resize updates without Radix Tooltip state
