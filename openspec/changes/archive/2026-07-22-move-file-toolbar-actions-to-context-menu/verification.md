# Verification

## Summary

`move-file-toolbar-actions-to-context-menu` 的实现与 proposal、design 和 delta spec 一致。文件内容区使用 shared `RendererContextMenu`；Clipboard failure 不会删除 selection；main/detached header 统一为 back/leading action + tabs 单行结构，旧 `.fvp-topbar` 不再渲染。

## Evidence

- `src/features/files/components/FileViewPanel.tsx`
  - file content context menu、Cut/Copy/Paste、existing command handlers、single-row header。
- `src/features/files/components/FileViewPanel.test.tsx`
  - clipboard success、failed Cut preservation、preview disabled states、navigation/edit/preview/save migrated entry。
- `src/features/files/components/FileViewPanel.git-blame.test.tsx`
  - Git Blame enable/disable/loading/stale/error and repository scope through the new menu。
- `src/styles/file-view-panel-visual-contract.test.ts`
  - shared menu visual token and legacy toolbar CSS removal。

## Automated Checks

- `npx vitest run src/features/files/components/FileViewPanel.test.tsx src/features/files/components/FileViewPanel.git-blame.test.tsx src/styles/file-view-panel-visual-contract.test.ts --reporter=dot`：95 passed。
- Targeted ESLint for touched frontend files：passed。
- `npm run typecheck`：passed。
- `openspec validate --change move-file-toolbar-actions-to-context-menu --strict`：passed。
- `npm run check:large-files`：report mode completed；仓库存在既有 baseline findings，本变更未新增 fail-threshold source file。未执行全量 test suite，遵循用户明确要求。

## Manual Acceptance

- [ ] 用户在桌面应用中验收菜单定位、系统 Clipboard permission、main/detached header 视觉与实际鼠标交互。

手工验收保留为 unchecked，不伪报通过；自动化 contract 已完成，可归档实现 change。
