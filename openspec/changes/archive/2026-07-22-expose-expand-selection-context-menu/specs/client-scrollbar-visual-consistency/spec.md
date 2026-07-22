## ADDED Requirements

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
