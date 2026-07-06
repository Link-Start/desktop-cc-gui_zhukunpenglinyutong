# Proposal: 文件树根目录 header 暴露创建入口

## Why

当前文件树顶部在根目录区域只保留右侧工具按钮，用户想在 workspace root 新建文件或文件夹时，
需要先找 context menu，入口不够直接。用户给出的目标是保留 shadcn/UI 极简风格：
左侧显示 workspace/file tree root name，右侧只放 `New File`、`New Folder`、`Refresh`
三个操作。

## What Changes

- `FileTreeRootActions` 渲染 root header：左侧显示当前 workspace root label。
- 右侧新增三个 icon-only action：`New File`、`New Folder`、`Refresh`。
- 三个 action 复用现有 `FileTreePanel` root 操作链路：
  - `openNewFilePrompt("")`
  - `openNewFolderPrompt("")`
  - `refreshFileTree()`
- 保留现有 Spec Hub / detached explorer 入口的可配置能力，但默认文件树 header 的 root action 只外显用户要求的三项。

## Impact

- Affected spec: `workspace-filetree-management-actions`
- Affected code:
  - `src/features/files/components/FileTreeRootActions.tsx`
  - `src/features/files/components/FileTreeRootActions.test.tsx`
  - `src/features/files/components/FileTreePanel.tsx`
  - `src/features/files/components/FileTreePanel.run.test.tsx`
  - `src/styles/file-tree.css`
