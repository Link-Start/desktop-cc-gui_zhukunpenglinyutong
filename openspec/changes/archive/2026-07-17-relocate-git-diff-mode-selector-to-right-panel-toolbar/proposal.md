## Why

右侧 Git 面板的 `Diff` mode selector 当前占用内容区顶部的独立浮动行，与同一面板的 tab navigation 分属两个视觉层级。将原 selector 移入 `right-panel-toolbar` 左侧，可以让导航与当前 Git 子视图选择形成稳定的“全局 tab / 局部 mode”层级，同时释放 changed-file 内容区的垂直空间。

## 目标与边界

- 仅在右侧 `git` tab 激活时，将现有 `Diff / Git / Issues / PRs` selector 显示在 `right-panel-toolbar` 左侧。
- 复用同一个 selector、state、refs 与 callbacks，不复制 mode menu 或 Git action 逻辑。
- 保留 flat/tree layout、Hub、outside click、Escape focus restore、shortcut 与 narrow-width menu placement 行为。
- 保持 normal 与 swapped desktop layout 的镜像顺序，并保证 menu 不被 toolbar clipping。

## 非目标

- 不修改 Git mode、file list、commit、repository 或 Hub 的业务语义。
- 不改变 `PanelTabs` 的 pin/overflow 策略。
- 不迁移 worktree apply action，不新增 dependency、design token 或持久化状态。
- 不调整 compact/phone/tablet Git navigation。

## What Changes

- 为 desktop `right-panel-toolbar` 增加仅在 `git` tab 激活时存在的 mode selector mount target。
- 通过 React Portal 将 `GitDiffPanel` 现有 mode selector 挂载到该 target；target 不可用时保留原 inline fallback。
- selector 外置后移除无必要的 Git content top reservation；worktree apply action 继续使用原浮动 action row。
- 增加 location contract 与既有 menu behavior 的 focused regression coverage。

## 方案对比

- **推荐：显式 mount target + React Portal。** 原 component state、refs、event handlers 和 accessibility attributes 保持同源，只有 DOM owner 改变；项目已有 `headerControlsTarget` / `createPortal` precedent。
- **备选：CSS negative offset / absolute cross-layer positioning。** 文件数更少，但控件仍属于 clipped content layer，容易被 `right-panel-toolbar`、`.right-panel` overflow、swapped layout 与窄宽度破坏，因此不采用。
- **不采用：在 `PanelTabs` 重建 selector。** 会提升 Git state 并复制 menu wiring，扩大 cross-feature contract，违反最小改动与 single source of truth。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `git-panel-diff-view`: Git mode selector 的 desktop placement 从 Git content layer 改为 right panel toolbar 左侧，同时保持所有既有交互能力。

## Impact

- Frontend component：`GitDiffPanel`、`useLayoutNodes`、`layoutNodeSections`。
- Styling：`src/styles/diff.css`、`src/styles/main.css`。
- Tests：Git selector location/behavior 与 right toolbar visibility focused suites。
- API / backend / storage：无影响。
- Dependency：无新增。

## 验收标准

- 激活右侧 Git tab 后，当前 mode selector 位于顶部栏左侧，panel tabs 仍在右侧。
- 切换到其他右侧 tab 后，不残留 Git selector。
- selector 的 mode、flat/tree、Hub、outside click、Escape 与 shortcut 行为和改动前一致。
- menu 在 normal/swapped layout 与 narrow right panel 中保持可见且不产生 horizontal overflow。
- Git content area 不再为已外置 selector 保留空白行；worktree apply action 仍可达。
- focused Vitest、lint、typecheck、large-file gate 与 strict OpenSpec validation 通过。
