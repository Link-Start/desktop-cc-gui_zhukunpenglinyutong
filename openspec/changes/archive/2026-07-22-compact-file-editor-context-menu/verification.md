## Verification

### 完整性

- 3/3 tasks complete。
- 1/1 delta requirement 已映射到 scoped CSS 与 focused contract test。

### 正确性

- file editor menu outer padding 为 `5px`。
- item min-height 为 `30px`，padding 为 `5px 8px`；继承并保持 `13px` font。
- separator margin 为 `4px 5px`。
- icon container 与 SVG 均为 `14px`。
- `overflow-y: auto`、hidden scrollbar chrome、menu width、action order 与 shortcut rendering 未改变。

### 一致性

- compact overrides 仅位于 `.fvp-file-context-menu` scope。
- tab context menu 和 shared `RendererContextMenu` defaults 未修改。
- 无 JS、i18n、backend、dependency 或 persistence 变更。

### Automated Evidence

- `npx vitest run src/styles/file-view-panel-visual-contract.test.ts`：1 file / 11 tests passed，最终复测 passed。
- `npm run typecheck`：passed。
- incremental ESLint：passed。
- `git diff --check`：passed。
- `openspec validate compact-file-editor-context-menu --strict --no-interactive`：passed。

### Scope Note

- 按用户要求未运行 full test suite。
- 未执行 Git commit。
