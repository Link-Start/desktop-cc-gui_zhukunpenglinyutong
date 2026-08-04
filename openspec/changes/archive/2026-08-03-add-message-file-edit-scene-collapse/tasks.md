## 1. Presentation shell

- [x] 1.1 `ToolMarkerShell`：clickable 时补 `aria-expanded`、键盘 Enter/Space、可聚焦
- [x] 1.2 `EditToolGroupBlock`：默认折叠；文案 `fileEditSceneCount`；折叠态不露聚合 +/-；展开体无边框
- [x] 1.3 `FileChangeToolContent`：默认场景折叠，摘要含 count，展开后原 FileChangeRow 列表
- [x] 1.4 `groupToolItems`：`edit` category 即使 1 项也产出 `editGroup`

## 2. i18n

- [x] 2.1 全 locale 增加 `tools.fileEditSceneCount` / `tools.fileEditSceneToggle`

## 3. Tests

- [x] 3.1 更新 `EditToolGroupBlock.test.tsx`（默认折叠、toggle、多场景、键盘）
- [x] 3.2 更新 `groupToolItems.test.ts`（单 edit → editGroup）
- [x] 3.3 `FileChangeToolContent` 或 Generic file-change 折叠行为覆盖

## 4. Verify

- [x] 4.1 focused Vitest + typecheck
- [ ] 4.2 人工幕布 smoke（不提交，留给用户）

## 5. Review 补丁（fix+optimize）

- [x] 5.1 折叠态懒解析 diff（展开场景才算 stats，行内再 loadDiff）
- [x] 5.2 editGroup projection key 仅 firstId，streaming 增长不 remount
- [x] 5.3 折叠头聚合 status（failed/processing）
- [x] 5.4 path 轻量归一 + 列表可见高度 6 行
- [x] 5.5 ToolMarkerShell：显式 role=group 不伪装 button
- [x] 5.6 抽出 fileEditSceneUtils，避免组件互相 import
