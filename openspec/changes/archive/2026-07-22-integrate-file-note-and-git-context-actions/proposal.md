## Why

文件内容区目前由 `FileViewBody` 单独弹出“保存到便签”菜单，同时 `FileViewPanel` 又弹出统一文件菜单，导致同一次右键出现两个相互独立的 popover。文件内容菜单也尚未像 file tab context menu 一样把 `显示文件历史` 与 `Git Blame` 收敛到 `Git 操作` submenu。

## 目标与边界

- 文件内容区每次右键只出现一个 shared renderer context menu。
- 有 canonical code selection 时保存该选区；无选区时保存当前完整文本文件。
- 完整文件 capture 使用当前 editor canonical document，保留未保存修改；preview 使用已加载的完整 source snapshot。
- `Git 操作` submenu 复用现有 repository scope、File History callback 与 Git Blame handler。
- truncated、空白或非文本 surface 不生成伪造的完整文件便签。

## 非目标

- 不修改 note workbench 的确认、保存、归档或持久化流程。
- 不为 Markdown rendered DOM、binary/document/media preview 猜测 source line range。
- 不新增 Git mutation action，不改变 File History 或 Git Blame backend contract。
- 不重构 `RendererContextMenu` shared component。

## What Changes

- 移除 `FileViewBody` 自己维护的 note capture popover，把 canonical selection draft 交给 `FileViewPanel` 统一组合菜单。
- 文件内容菜单首项根据 capture snapshot 显示“将所选代码保存到便签…”或“将整个文件保存到便签…”。
- 文件内容菜单新增 `Git 操作` submenu，包含可用的 `显示文件历史` 与 `显示/隐藏 Git Blame`。
- 增加 i18n 文案与 focused regression tests。

## 方案比较

### 方案 A：父层统一 menu ownership（采用）

`FileViewBody` 只负责产出 canonical selection draft；`FileViewPanel` 负责 menu state、command composition 与 positioning。单一 owner 从结构上消除双菜单，并能复用 active file 的 Git scope。

### 方案 B：保留两个菜单并做互斥协调（不采用）

通过 `defaultPrevented` 或额外 state 阻止其中一个 popover。改动较小，但 command 顺序、dismiss、viewport clamp 与后续扩展仍存在两套状态，容易再次漂移。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `filetree-multitab-open`: 扩展 file content context menu 的 note capture fallback、single-popover 与 Git submenu 行为。

## 验收标准

- 编辑态有选区时，单一菜单保存精确选区与行号。
- 编辑态无选区时，单一菜单保存当前完整 editor document，包括未保存修改。
- code preview 有逻辑行选区时保存选区；无选区时保存完整 source。
- 空白、truncated 或不支持的 surface 不保存不完整内容。
- `Git 操作` submenu 在有效 repository scope 下展示 File History 与 Git Blame，并复用 nested repository identity。
- focused Vitest、targeted ESLint、typecheck 与 strict OpenSpec validation 通过；不要求全量测试。

## Impact

- Frontend：`FileViewPanel.tsx`、`FileViewBody.tsx`、相关 focused tests。
- i18n：`src/i18n/locales/*/noteCards.ts`。
- Behavior spec：`filetree-multitab-open`。
- 不新增 dependency，不修改 backend/API/persistence schema。
