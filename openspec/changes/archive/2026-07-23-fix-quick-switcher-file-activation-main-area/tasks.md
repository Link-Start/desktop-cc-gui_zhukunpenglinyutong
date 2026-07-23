## 1. Root-cause alignment

- [x] 1.1 [P0, depends: none] 确认 `useAppShellQuickSwitcherSection.handleQuickSwitcherSelectFile` 当前不翻 `appMode` / `activeTab`，对比 `handleQuickSwitcherSelectSession` 已有的 `setAppMode("chat")` + `setActiveTab("codex")` 模式，记录本文件作为唯一缺失点。
- [x] 1.2 [P0, depends: 1.1] 确认 `useGitPanelController.handleOpenFile` 不应在 Quick Switcher 路径之外被改写：它仍是 canonical contract，被 FileTree / SearchPanel / Git inline preview 等入口共享。

## 2. Fix

- [x] 2.1 [P0, depends: 1.1, 1.2] 在 `useAppShellQuickSwitcherSection.handleQuickSwitcherSelectFile` 的 `selectWorkspace` 之前加 `setAppMode("chat")` + `setActiveTab("codex")` + `setHomeOpen(false)` + `setWorkspaceHomeWorkspaceId(null)`，并把这四个 setter 加入 `useCallback` 依赖数组。
- [x] 2.2 [P0, depends: 2.1] 扩展 `QuickSwitcherShellBoundary` input 类型与 `useAppShellQuickSwitcherSection` destructure 以接收 `setHomeOpen` / `setWorkspaceHomeWorkspaceId`；在 `src/app-shell.tsx:2345` 的 `useAppShellQuickSwitcherSection` 调用处注入这两个 setter。
- [x] 2.3 [P0, depends: 2.1] 更新 `useAppShellQuickSwitcherSection.test.tsx`：① 已有 file activation 用例断言四个 setter 都触发；② 新增 "closes the home surface before opening the file from the bootstrap shell state" 用例，断言 `setHomeOpen(false)` 在 `handleOpenFile` 之前（`mock.invocationCallOrder` 锁序）。

## 3. Spec delta

- [x] 3.1 [P0, depends: 2.1] 在 `openspec/changes/fix-quick-switcher-file-activation-main-area/specs/quick-context-switcher/spec.md` 中追加 ADDED Requirement "Recent-file activation MUST close the home surface before delegating to the file-open action"，含两条 scenario：① bootstrap 启动态下 file row 激活必须先关 home surface 再委托 `handleOpenFile`；② home-state setters 严格早于 `handleOpenFile`，并复用 `setHomeOpen` / `setWorkspaceHomeWorkspaceId` canonical contract。

## 4. Verification

- [x] 4.1 [P0, depends: 2.3, 3.1] 运行 focused Vitest：`useAppShellQuickSwitcherSection.test.tsx` 5/5 通过；`app-shell-parts/**` 41 文件 / 277 用例全绿。
- [x] 4.2 [P0, depends: 4.1] `npm run typecheck` 与 `npx eslint` 对变更文件零警告；`git diff --check` 干净。
- [x] 4.3 [P0, depends: 4.2] `openspec validate fix-quick-switcher-file-activation-main-area --strict --no-interactive` 通过。
- [x] 4.4 [P1, depends: 4.3] 人工验收（用户已在桌面客户端确认通过）：① 启动后直接 Quick Switcher → file row 激活 → 主面板落回 file editor（截图 bug 复现路径）；② 从 kanban / gitHistory / spec tab 触发 Quick Switcher file row 激活，center-area 出现 editor、Quick Switcher 关闭、sidebar 既有 `requestEditorOpenLayout` 行为不变。

## Verification Record

- Focused Vitest：`useAppShellQuickSwitcherSection.test.tsx` 5 用例（含新增启动态场景）通过；`app-shell-parts/**` 41 文件 / 277 用例全绿；`useGitPanelController.test.tsx` 43/43；`quick-switcher/**` + `useAppShellSearchAndComposerSection.test.tsx` 25/25。
- TypeScript：`npm run typecheck` 通过。
- ESLint：变更文件零警告。
- Diff hygiene：`git diff --check` 干净。
- OpenSpec：strict validation 通过。
- 人工验收：用户已确认 bootstrap、non-chat mode 与 non-codex tab 三类路径通过。
