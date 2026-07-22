## Why

打开文件后，用户只能从文件内容或 tab 继续编辑，无法快速确认该文件在 workspace file tree 中的层级位置。深层目录场景需要手动逐级展开和搜索，打断代码阅读流。

## 目标与边界

- 在 file content context menu 增加“定位到文件”入口。
- 点击后切换或展开当前 surface 的 file tree，展开目标文件全部 ancestor directories，选中目标行并滚动至可视区域。
- 主窗口与 detached file explorer 复用同一 reveal contract。
- 定位动作只改变 file tree 的展示与 selection，不改变 open tabs、active file、编辑内容或磁盘状态。

## 非目标

- 不新增全局文件搜索、模糊匹配或 backend API。
- 不扩展 file tab context menu；本次入口严格位于截图所示的 file content context menu。
- 不持久化定位请求或 file tree selection。
- 不改变 Finder/Explorer 的 `Reveal in Finder` 行为。

## What Changes

- 为 `FileViewPanel` 增加可选的 file-tree reveal callback，并在 file content context menu 暴露本地化动作。
- 在 main layout 与 detached file explorer 内建立一次性 reveal request 通道。
- `FileTreePanel` 消费请求后展开全部 ancestor directories、单选目标文件，并将目标 row 滚动到最近可视位置。
- 增加 main/detached surface 与 repeated reveal 的回归测试。

## 方案比较

### 方案 A：一次性 reveal request（采用）

由共同 owner 传递 `{ path, requestId }`。`FileTreePanel` 保持 selection/expansion 的唯一 owner，仅消费 intent。优点是改动局部、重复点击可重放、不引入全局状态；代价是 main 与 detached owner 各需要少量 wiring。

### 方案 B：将 file tree selection 提升到全局 store（不采用）

多个 surface 可直接共享 selection，但会扩大根级状态和 render fan-out，并破坏 detached session 独立性。当前需求不需要跨窗口共享 selection，属于过度设计。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `filetree-multitab-open`: 文件内容右键菜单新增目标感知的 file tree reveal 行为。
- `independent-file-explorer-workspace`: detached explorer 内的 reveal 行为保持在自身 browsing session 中。

## 验收标准

- 深层文件执行“定位到文件”后，全部 ancestor directories 展开，目标文件成为 primary single selection。
- 目标 row 在下一次 render 后调用 `scrollIntoView({ block: "nearest" })`。
- main window 在其他 right-panel mode 时切回 Files；detached sidebar 折叠时自动展开。
- 连续对同一文件执行定位仍会再次滚动。
- open tabs、active file、editor buffer 和 filesystem 不发生额外变化。
- i18n、focused Vitest、lint、typecheck 与 strict OpenSpec validation 通过。

## Impact

- Frontend: `src/features/files/components/FileViewPanel.tsx`、`FileTreePanel.tsx`、`FileTreeRows.tsx`、`FileExplorerWorkspace.tsx`、`src/features/layout/hooks/useLayoutNodes.tsx`。
- Tests: file view、file tree、workspace integration focused suites。
- i18n: `src/i18n/locales/*/files.ts`。
- Specs: `filetree-multitab-open`、`independent-file-explorer-workspace`。
- 无 backend、Tauri command、dependency、storage 或 migration 变更。
