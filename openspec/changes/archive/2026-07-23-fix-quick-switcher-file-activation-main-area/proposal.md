## Why

`add-quick-switcher` 已经把最近文件激活绑定到现有 canonical file-open path：`QuickSwitcher` 的 file row 通过 `onSelectFile(workspaceId, path)` 透传给 `useAppShellQuickSwitcherSection.handleQuickSwitcherSelectFile`，后者调用 `useGitPanelController.handleOpenFile`。这条 wire 与现有 canonical contract 一致，但行为契约漏了两条上下文前提：

**前提一：appMode / activeTab 翻转。** `handleOpenFile` 内部只把 `centerMode` 设为 `editor`、在 `isCompact` 时同步把 `activeTab` 设为 `codex`，并不会主动把 `appMode` 翻回 `chat`。当用户在非 chat mode（`kanban` / `gitHistory`）或非 codex tab（`spec` / `git` / `log`）下打开 Quick Switcher 并点击最近文件，文件 tab 已经被 `setFileTabsByWorkspace` 写进去，但主面板的 center-area 渲染走的是 `appMode === "chat" && activeTab === "codex"` —— 上下文没切，editor 就落在被当前 mode/tab 遮住的后面。

**前提二：home 表面关闭。** AppShell 的 `showHome = (!activeWorkspace || homeOpen) && !showKanban`。在 bootstrap 启动态（`activeWorkspace === null`、用户从未点过 workspace、composer 下拉的 "mossx" 只是默认 `homeWorkspaceDefaultId` 的展示），最近文件 MRU 是从 client-store 持久化读出来的，不依赖当前 workspace。用户直接打开 Quick Switcher 点击 file row 时，文件 tab 已被 `handleOpenFile` 写入（因为 `targetWorkspace` 通过 options 传入），但 `selectWorkspace(workspaceId)` 异步翻 `activeWorkspace` —— 同步 render 周期里 `activeWorkspace` 仍是 null，`showHome` 仍是 true，主面板渲染 homeNode 把刚写入的 file tab 全部遮住。这是"刚打开客户端直接点最近文件失败"的根因。

对比同 hook 里的 `handleSelectThread`（`src/app-shell-parts/useAppShellSections.ts:251-272`）和 `handleStartWorkspaceConversation`（同文件 :297-300）：它们在切到 workspace / thread 之前都同步执行 `setHomeOpen(false)` + `setWorkspaceHomeWorkspaceId(null)`。这是 canonical contract 的入口写法，Quick Switcher file 路径需要补齐。

事实源：
- 现象一：非 chat mode / 非 codex tab 触发 Quick Switcher file row 时，文件 tab 已写入但 center-area editor 不可见。
- 现象二：bootstrap 启动态下，未选 workspace 时直接通过 Quick Switcher 打开最近文件，主面板仍显示 homeNode "创造任何东西"，而不是 file editor。
- 触点：`src/app-shell-parts/useAppShellQuickSwitcherSection.ts` 中 `handleQuickSwitcherSelectFile` 调用 `handleOpenFile` 之前未翻 `appMode` / `activeTab`，也未调 `setHomeOpen(false)` / `setWorkspaceHomeWorkspaceId(null)`。
- 旁证：同文件 `handleQuickSwitcherSelectSession` 已经显式 `setAppMode("chat")` + `setActiveTab("codex")`；同仓 `handleSelectThread` 已经显式 `setHomeOpen(false)` + `setWorkspaceHomeWorkspaceId(null)`。Quick Switcher file 路径同时漏掉这两组前置。

## 目标与边界

- 目标：Quick Switcher file row 激活后，无论当前 `appMode` 与 `activeTab` 是什么，主面板 center-area 必须呈现该文件，而不是被当前 mode/tab 遮蔽。
- 目标：bootstrap 启动态下（`activeWorkspace === null`、`homeWorkspaceDefaultId` 仅作 home dropdown 占位、用户未真正点过 workspace），Quick Switcher file row 激活后必须落回主面板呈现 editor，而不是被 homeNode 覆盖。
- 目标：file row 激活路径必须与 `handleSelectThread` 共享同一组 home-state + appMode + activeTab 翻转前置条件；保持 canonical open action 不变（继续走 `handleOpenFile`）。
- 边界：只补 `handleQuickSwitcherSelectFile` 漏掉的四个 setter；不修改 `handleOpenFile` 自身、不引入新 prop、不动 Quick Switcher 面板的 UI / 键盘 / MRU 规则。

## 非目标

- 不改变 `QuickSwitcher` 组件、`onSelectFile` 回调签名或最近文件 MRU 持久化逻辑。
- 不重写 `handleOpenFile` 内部顺序，不调整 `setCenterMode("editor")`、`setEditorSplitCompanion`、`setFileTabsByWorkspace` 等既有 step。
- 不修改 `handleQuickSwitcherSelectSession` 行为；其当前 `setAppMode("chat")` + `setActiveTab("codex")` 契约保持不变。
- 不动 desktop titlebar icon、`⌘E` shortcut、Search Palette 或 detached file explorer 行为。
- 不为 sidebar collapse / `requestEditorOpenLayout` 引入新分支——那是 `handleOpenFile` 既有的"打开即给编辑器腾位"契约，不在本修复范围。

## What Changes

- 在 `useAppShellQuickSwitcherSection.handleQuickSwitcherSelectFile` 中，于 `selectWorkspace` / `handleOpenFile` 之前显式调用 `setAppMode("chat")` + `setActiveTab("codex")` + `setHomeOpen(false)` + `setWorkspaceHomeWorkspaceId(null)`，并把这四个 setter 加进 `useCallback` 依赖数组。
- 扩展 `QuickSwitcherShellBoundary` 类型与 `useAppShellQuickSwitcherSection` destructure 以透传 `setHomeOpen` / `setWorkspaceHomeWorkspaceId`；在 `src/app-shell.tsx` 调用处把这两个 setter 注入 input。
- 新增 `useAppShellQuickSwitcherSection` 单元测试场景：
  - 启动态 `activeWorkspaceId === null` 时点击 file row，必须先调 `setHomeOpen(false)` + `setWorkspaceHomeWorkspaceId(null)` 再调 `handleOpenFile`（mock invocationCallOrder 断言）。
  - 现有 "opens a file against its owning workspace and routes to the main codex area" 用例补充对四个 setter 的断言。
- 不修改 `QuickSwitcher` 组件、不修改 `handleOpenFile` 自身；在 `quick-context-switcher` spec 中新增两条 requirement（共 5 个 scenario）描述本契约：上下文翻转 + home 表面关闭。

## 技术方案对比

### Option A：补齐 Quick Switcher file 激活的上下文前置（采用）

- `handleQuickSwitcherSelectFile` 复用 `handleQuickSwitcherSelectSession` 已有的 `setAppMode("chat")` + `setActiveTab("codex")` 模式。
- 优点：diff 极小；契约对称；不污染 `handleOpenFile`；聚焦于 "Quick Switcher 必须保证激活后用户能看到结果"。
- 代价：依赖数组新增两个 setter；新增一个 spec scenario。

### Option B：把上下文翻转下沉到 `handleOpenFile` 自身

- 在 `useGitPanelController.handleOpenFile` 第一步就 `setAppMode("chat")` + `setActiveTab("codex")`。
- 优点：调用方无需关心上下文。
- 代价：`handleOpenFile` 是 canonical contract，被多处复用（FileTree、SearchPanel、Git panel、Chat file reference 等）；改动会破坏 editor split preservation 等既有非 chat 入口语义（例如 Git diff inline preview）。范围明显超出 Quick Switcher bug。

### Option C：让 Quick Switcher 在打开前先把当前上下文暂存并在关闭后还原

- 记录 `appMode` / `activeTab`，关闭面板时还原。
- 优点：保留"激活前上下文"。
- 缺点：与现有 session row / Spec Hub navigation 行为不一致；增加新的 state 字段；与本 bug 的根因不同。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `quick-context-switcher`：新增两条 requirement，共 5 个 scenario，覆盖
  - file row 激活后必须显式把主面板上下文翻回 chat mode + codex tab；
  - file row 激活前必须关闭 home 表面（global home + workspace home），使 bootstrap 启动态下文件 editor 也能落到可见主区。

## Impact

- Affected code:
  - `src/app-shell-parts/useAppShellQuickSwitcherSection.ts`（扩展 input 类型、destructure、`handleQuickSwitcherSelectFile` 与 `useCallback` 依赖）
  - `src/app-shell.tsx`（`useAppShellQuickSwitcherSection` 调用处注入 `setHomeOpen` / `setWorkspaceHomeWorkspaceId`）
  - `src/app-shell-parts/useAppShellQuickSwitcherSection.test.tsx`（新增启动态场景 + 收紧已有 file activation 用例）
- Affected spec:
  - `openspec/changes/fix-quick-switcher-file-activation-main-area/specs/quick-context-switcher/spec.md`
- APIs: 无外部 API 变化；`onSelectFile(workspaceId, path)` 签名不变。
- Storage: 无 schema 变化；不新增 client-store key。
- Backend / Tauri: 无。
- Dependencies: 不新增。

## 验收标准

- 从 `kanban` 或 `gitHistory` 等非 chat mode 下打开 Quick Switcher 并激活 file row，center-area 必须显示该文件 editor，而不是保留原 mode。
- 从 `activeTab === "spec"` / `"git"` / `"log"` 下激活 file row，主面板必须落到 codex tab + editor，而不是被原 tab 遮住。
- bootstrap 启动态（`activeWorkspaceId === null`）下激活 file row，主面板必须落回 file editor 而不是 homeNode；`setHomeOpen(false)` + `setWorkspaceHomeWorkspaceId(null)` 必须在 `handleOpenFile` 之前发生（由 mock invocationCallOrder 锁序）。
- `setActiveTab("codex")` 与 `setAppMode("chat")` 必须在 `handleOpenFile` 之前被调用，确保 `setCenterMode("editor")` 落到可见 context。
- 现有 session row 激活行为不变；Quick Switcher UI / 键盘 / MRU 行为不变；`handleOpenFile` 既有 step 顺序不被破坏。
- `npm run typecheck`、`npx eslint <changed files>`、目标 Vitest 用例通过；strict OpenSpec validation 通过。
