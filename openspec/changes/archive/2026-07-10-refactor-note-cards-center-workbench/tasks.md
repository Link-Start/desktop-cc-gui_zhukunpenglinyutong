## 1. Center Workbench Wiring

- [x] 1.1 [P0] 扩展 `CenterMode` 与 note toolbar selection handler；输入为 `filePanelMode=notes`，输出为显式 notes center state；验证 controller/layout tests。
- [x] 1.2 [P0, depends: 1.1] 输出独立 `noteCardsPanelNode` 并在 `DesktopLayout` 组合左 chat / 右 note 1:2 split；验证 DOM layer、interactive state 与 Composer placement。
- [x] 1.3 [P0, depends: 1.2] 增加带 min-width clamp 的 draggable separator；验证 pointer resize 与 accessibility contract。

## 2. Note Surface Refactor

- [x] 2.1 [P0, depends: 1.2] 重构 `WorkspaceNoteCardPanel` 为 compact workbench 信息架构，保留 CRUD/Markdown/image handlers；验证现有 focused tests。
- [x] 2.2 [P1, depends: 2.1] 接入 collection-scoped query 与 async stale-response guard；验证 active/archive request payload 和 empty search state。
- [x] 2.3 [P1, depends: 2.1] 更新 note card CSS 与中英文 copy，保证 desktop 1:2、narrow responsive、按钮可访问名称和无重叠。

## 3. Verification

- [x] 3.1 [P0, depends: 2.2, 2.3] 增补/更新 layout、entry 与 note CRUD/search Vitest coverage，并执行 focused suites。
- [x] 3.2 [P0, depends: 3.1] 执行 `npm run typecheck`、`npm run lint` 与 OpenSpec strict validation，记录任何 pre-existing failure。
- [x] 3.3 [P1, depends: 3.2] 启动本地 app/dev surface，以实际 Tauri desktop surface 验证 composition、无 blank/overlap 与基本交互。
