## 1. Context Menu Contract

- [x] 1.1 [P0][depends:none][I: active file mode、CodeMirror/DOM selection、existing file handlers][O: file content `RendererContextMenuItem[]` with clipboard and toolbar commands][V: focused `FileViewPanel.test.tsx` asserts labels、disabled states and handler calls] 实现目标感知的文件内容右键菜单。
- [x] 1.2 [P0][depends:1.1][I: Clipboard API and CodeMirror selection][O: lossless Cut/Copy/Paste behavior with explicit failure toast][V: focused tests cover successful Copy/Paste and failed Cut preserving content] 接入安全 clipboard commands。

## 2. Header Consolidation

- [x] 2.1 [P0][depends:none][I: existing main/detached header variants][O: back/leading action + tabs + status in one row, legacy toolbar removed][V: component tests assert leading callback compatibility and absence of `.fvp-topbar`] 合并 file header 为单行布局。
- [x] 2.2 [P1][depends:1.1,2.1][I: existing file tab context-menu CSS][O: shared scoped menu visual contract and obsolete toolbar styles cleanup][V: `file-view-panel-visual-contract.test.ts` asserts menu tokens and removed toolbar render contract] 对齐菜单与 header 样式。

## 3. Compatibility And Verification

- [x] 3.1 [P0][depends:1.1,1.2,2.1][I: all locale `files.ts` resources][O: localized menu/clipboard labels and errors][V: typecheck and focused menu queries resolve translated keys] 补齐 i18n。
- [x] 3.2 [P0][depends:2.2,3.1][I: touched frontend files and OpenSpec delta][O: passing focused Vitest、CSS contract、typecheck and strict OpenSpec validation][V: command output recorded; no full test suite] 执行增量质量门禁。
- [x] 3.3 [P1][depends:3.2][I: completed implementation and validation evidence][O: synchronized main spec、verification artifact and archived change][V: OpenSpec status/list confirms closure] 完成 OpenSpec verify/sync/archive 闭环。
