# client-scrollbar-visual-consistency Specification

## Purpose

定义客户端 shared scroll containers 与 Terminal scrollbar 的 geometry 和 theme contract。

## Requirements

### Requirement: Shared scroll containers use stable geometry

客户端主要 scroll containers MUST 使用一致的 scrollbar width、track 与 thumb geometry，并 MUST 保持 content width 在 hover/active 状态下稳定。

#### Scenario: Scroll across application surfaces

- **WHEN** 用户在 message、sidebar、settings、file 或 Terminal scroll container 中滚动
- **THEN** scrollbar geometry MUST 保持一致，且 scrollbar appearance 不得导致内容横向跳动

### Requirement: Scrollbar colors follow active theme

Scrollbar thumb/track MUST 使用带 fallback 的 theme tokens，Terminal scrollbar MUST 与应用当前 light/dark theme 保持可见对比度。

#### Scenario: Switch application theme

- **WHEN** 用户切换 light/dark theme
- **THEN** Terminal 和 shared scroll containers 的 scrollbar MUST 更新为对应 theme colors，且 token 缺失时仍有可见 fallback

### Requirement: File Editor Context Menu MUST Hide Scrollbar Chrome Without Disabling Scrolling

文件编辑器 context menu MUST 隐藏纵向 scrollbar chrome，同时 MUST 保留内容 overflow 与用户滚动能力。

#### Scenario: overflowing context menu remains scrollable
- **WHEN** 文件编辑器 context menu 的内容高度超过 menu max-height
- **THEN** menu MUST 保持 `overflow-y: auto`
- **AND** 鼠标滚轮、触控板及 programmatic scroll MUST 继续工作

#### Scenario: scrollbar chrome is hidden across desktop webviews
- **WHEN** 文件编辑器 context menu 在 macOS WebKit、Windows WebView2 或 Linux WebKitGTK 中渲染
- **THEN** scrollbar track 与 thumb MUST 不可见
- **AND** 该规则 MUST NOT 改变其它 `RendererContextMenu` 实例的 scrollbar 表现

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
