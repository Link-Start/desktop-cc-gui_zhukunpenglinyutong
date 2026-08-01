## Why

文件 tab 右键菜单目前只有“关闭全部标签”，既无法表达右键目标，也缺少常用的 tab 生命周期、detached window 与文件级 Git 入口。需要把它收敛为一个目标明确、视觉一致、可键盘访问的上下文菜单，减少用户在 tab、文件树和 Git 面板之间往返。

## 目标与边界

- 右键某个文件 tab 时，菜单 MUST 绑定该 tab，而不是隐式使用当前 active tab。
- 菜单提供 `Git 操作`、`关闭当前`、`关闭其他`、`全部关闭`、`在新窗口打开标签`。
- `Git 操作` 仅包含只读的 `显示文件历史` 与 `Git Blame`，不引入 Stage、Unstage、Discard 等写操作。
- 复用既有 detached file explorer、file history、Git Blame 与 theme token；不新增 dependency。
- 主窗口与 detached file explorer 的 tab 菜单保持同一交互契约；不可用动作必须明确 disabled 或按能力隐藏。

## 非目标

- 不改变文件读写、dirty state、Git command 或 repository selection 语义。
- 不新增 repository 级 Commit、Pull、Push、Fetch 入口。
- 不重做 tab bar、拖拽排序或 editor session 架构。
- 不移除现有 tab 上的 detached window icon。

## What Changes

- 将单项自绘菜单替换为可复用的 renderer context menu，并增加 rounded surface、分组 separator、hover/focus 与左侧 icon。
- menu state 增加目标 `tabPath`，所有动作针对右键 tab 执行。
- 增加原子的 close-other-tabs state transition，保证 workspace/detached session 隔离。
- 复用现有 detached window 创建链路打开右键 tab。
- 复用现有 file history 与 Git Blame scope，构建只读 `Git 操作` submenu。
- 补齐 i18n、focused tests 与视觉 contract。

## 技术方案对比

### 方案 A：继续扩展 `FileViewPanel` 私有菜单

- 优点：改动文件少。
- 缺点：重复实现 viewport clamp、submenu、keyboard、outside click 和 icon layout；与项目其他 context menu 持续漂移。

### 方案 B：复用并最小扩展 `RendererContextMenu`（采用）

- 优点：沿用现有 portal、viewport clamp、submenu 与 accessibility contract；只增加 optional icon slot 和 file-tab menu model。
- 缺点：shared component 会有一个向后兼容的类型扩展，需要覆盖无 icon 的既有调用方。

选择方案 B。它以更小的长期维护成本复用成熟基础设施，同时不改变既有调用方行为。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `filetree-multitab-open`: 增加目标感知的文件 tab context menu、原子关闭其他 tab、detached open 与只读 Git submenu 行为。

## 验收标准

- 右键非 active tab 后，关闭当前、关闭其他和新窗口打开均作用于被右键 tab。
- 单 tab 时 `关闭其他` disabled；关闭其他后仅保留目标 tab 并将其设为 active。
- `Git 操作` 只包含 `显示文件历史` 与 `Git Blame`；没有 Git scope 的动作不可误执行。
- 所有菜单项有左侧 icon；菜单使用 theme token，在 light/dark theme 下保持可读。
- Escape、点击菜单外、window blur 均关闭菜单，菜单位置不越出 viewport。
- main 与 detached file explorer 的 tab state 互不污染。
- focused Vitest、lint、typecheck、large-file gate 与 strict OpenSpec validation 通过。

## Impact

- Frontend：`FileViewPanel`、tab state controller、detached explorer state、shared renderer context menu、CSS 与 i18n。
- Tests：file tab action targeting、close-other transition、Git submenu、detached open、icon/visual contract。
- APIs/dependencies：不新增 Tauri command，不新增 package dependency；只扩展 frontend callback/type。
