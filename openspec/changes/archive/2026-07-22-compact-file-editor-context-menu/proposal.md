## Why

文件编辑器右键菜单功能增多后，当前 `34px` item height 与 `8px` vertical padding 叠加出过高菜单，遮挡较多代码内容。需要压缩纵向密度，同时保持文字可读性、点击稳定性和现有滚动能力。

## 目标与边界

- 仅压缩文件编辑器 context menu 的纵向尺寸与 icon 视觉尺寸。
- 保留现有文字字号、菜单宽度、滚动能力、shortcut hint 和所有 action。
- 保持 tab context menu 与其它 `RendererContextMenu` 密度不变。

## 非目标

- 不重新排列、删除或合并 menu actions。
- 不修改全局 UI scale、字体系统或 shared menu defaults。
- 不修改 shortcut、CodeMirror command 或 backend behavior。

## What Changes

- 为 `.fvp-file-context-menu` 增加 scoped compact density overrides。
- item min-height 从 `34px` 降至 `30px`，vertical padding 从 `8px` 降至 `5px`。
- outer padding 从 `7px` 降至 `5px`，separator vertical spacing 从 `6px` 降至 `4px`。
- icon box 与 SVG 从 `16/15px` 降至 `14px`，文字字号与菜单 min-width 保持不变。
- 更新 file-view CSS contract test。

## 方案对比

1. **推荐：对 `.fvp-file-context-menu` 做 scoped override**。改动小，不影响 tab menu、Git menu 与 sidebar menu。
2. 修改 shared `.renderer-context-menu` defaults。代码更少，但会让所有业务菜单一起变密，回归面过大。
3. 调整全局 UI scale。会同时缩放 editor 和其它窗口，不符合本次边界。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `client-scrollbar-visual-consistency`: 扩展文件编辑器 context menu 的 compact density contract，同时保持 scrolling contract。

## Impact

- CSS：`src/styles/file-view-panel.css`。
- Test：`src/styles/file-view-panel-visual-contract.test.ts`。
- 无依赖、runtime state、i18n、backend 或 persistence 变更。

## 验收标准

- 文件编辑器 context menu 总高度明显缩短约一至两圈。
- item 仍保持不低于 `30px` 的点击区域，文字字号保持 `13px`。
- 长文案与 shortcut hint 仍使用原有宽度和 ellipsis contract。
- scrollbar chrome 继续隐藏，滚轮与触控板滚动继续可用。
- focused CSS contract、TypeScript、incremental ESLint、`git diff --check` 与 strict OpenSpec validation 通过。
