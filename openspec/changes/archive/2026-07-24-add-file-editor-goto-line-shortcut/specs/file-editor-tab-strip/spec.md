## ADDED Requirements

### Requirement: File tab strip preserves scrolling without visible scrollbar

系统 MUST 隐藏文件 tab strip 的视觉 horizontal scrollbar，同时保留原有横向滚动与 tab 操作行为。

#### Scenario: Overflowed tabs remain horizontally reachable

- **WHEN** 打开的文件 tab 总宽度超出 tab strip
- **THEN** horizontal scrollbar chrome MUST NOT 显示
- **AND** touchpad、mouse wheel adaptation 与 programmatic scrolling MUST 继续由 `overflow-x: auto` 支持

### Requirement: File tab icons match file tree icons

系统 MUST 对文件 tab 与文件树使用同一个 file icon resolver，避免相同文件类型出现不一致 icon。

#### Scenario: Same file has the same resolved SVG

- **WHEN** 同一文件名分别显示在 file tab 与 file tree
- **THEN** 两处 MUST 使用 `getFileTreeIconSvg(fileName, false)` 的相同 SVG 输出
- **AND** 未识别扩展名 MUST 使用同一个 fallback icon
