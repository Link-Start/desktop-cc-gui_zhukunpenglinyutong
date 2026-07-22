## ADDED Requirements

### Requirement: File Editor Context Menu MUST Use Compact Vertical Density

文件编辑器 context menu MUST 使用 scoped compact density，减少对 code surface 的遮挡，同时 MUST 保持文字可读、action 完整和 scrolling contract 不变。

#### Scenario: file editor menu renders compact rows
- **WHEN** 用户在 file editor 中打开 context menu
- **THEN** item clickable height MUST 不低于 `30px`
- **AND** vertical padding MUST 不超过 `5px`
- **AND** text size MUST 保持 `13px`

#### Scenario: compact density remains scoped
- **WHEN** compact file editor menu styles 生效
- **THEN** file tab context menu 与其它 `RendererContextMenu` instances MUST 保持原有 density
- **AND** menu width、action order、shortcut hint 与 overflow scrolling MUST remain unchanged

#### Scenario: icons scale with compact rows
- **WHEN** file editor context menu item 包含 icon
- **THEN** icon box 与 SVG MUST 使用 `14px` compact geometry
- **AND** icon MUST remain vertically centered with the label
