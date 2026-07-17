## Why

Git History 当前使用四区域布局，最左侧 overview/worktree 面板重复占用横向空间，压缩了分支、提交与变更详情三条核心浏览链路。现在需要隐藏该区域，让历史浏览聚焦于三栏主流程，并将释放的宽度交还给剩余区域。

## 目标与边界

- Git History 打开后只展示 `分支 / 提交 / 变更文件与提交详情` 三栏。
- 三栏继续占满 panel 可用宽度，并保留既有 column resize、branch navigation、commit selection 与 file diff preview 行为。
- overview/worktree surface 不再参与视觉布局或 accessibility tree；保留其 status 数据源挂载，以维持顶部 changed-file/line summary。

## 非目标

- 不迁移 overview/worktree commit surface 到其他栏位。
- 不改变 Git backend、repository selection、branch/commit 数据流或 diff contract。
- 不新增显示/隐藏开关，不重做三栏视觉设计。

## What Changes

- 将 Git History workspace 从四区域调整为三栏主布局。
- 隐藏最左侧 overview/worktree panel，并移除其相邻 vertical resizer。
- 让现有 branch/commit/details grid 直接占满 workbench 宽度。
- desktop 三栏在扣除两个 separator 后按 `3:4:3` 分配默认宽度。
- 清理失效的 overview resize path，并增加三栏可见结构回归断言。

## 方案比较

1. **推荐：隐藏 overview presentation，保留 status source。** overview 不参与 layout/accessibility，三栏获得完整宽度，同时顶部 worktree summary 继续由现有 callback 更新。
2. **备选：完全卸载 overview component。** DOM 更纯，但会切断顶部 changed-file/line summary，除非额外抽取 headless status hook；这会扩大改动与回归面，因此不采用。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `git-history-panel`: 将 Git History 的主布局 contract 从四区域改为三栏，移除 overview/worktree 区域并保留核心历史浏览行为。

## 验收标准

- `.git-history-overview` 不再可见且不进入 accessibility tree，overview 相邻 resizer 不再渲染。
- panel 仅显示 branch、commit、details 三个主区域并占满可用宽度。
- desktop 默认宽度比例为 branch `30%`、commit `40%`、details `30%`，用户拖拽 resize 行为保持不变。
- 既有 right-column split、file preview 与 branch/commit interaction 不受影响。
- focused Vitest、typecheck、lint、large-file check、`git diff --check` 与 strict OpenSpec validation 通过。

## Impact

- Frontend: `GitHistoryPanelView` 及其 view-model wiring、Git History layout CSS。
- Tests: Git History panel structure/layout regression coverage。
- API/dependencies: 无 backend/API 变更，无新增依赖，无 breaking data contract。
