## Why

Git History 顶部 title layer 需要比内容区更清晰的结构层次，但首版 `margin + four-sided border + radius + shadow` 把它呈现为独立 card，造成 titlebar 与下方三栏工作区分裂。需要将其校准为 edge-to-edge window chrome，在不改变交互与布局语义的前提下提升精致度。

## 目标与边界

- 将现有 Git History toolbar 呈现为 full-width integrated title band，以背景层次和底部结构线连接下方工作区。
- 压缩 title band 的装饰性垂直留白，让高度主要由现有 interactive controls 决定。
- normal state 与 repository empty state 使用同一视觉契约。
- 保留 picker dropdown、hover actions、keyboard focus、close action 与 narrow viewport 的现有行为。
- 仅调整 Git History title layer 样式，不改变 DOM、数据流或 Git command behavior。

## What Changes

- 移除 toolbar 的 inset margin、四边框、圆角和 ambient shadow，恢复 edge-to-edge panel chrome。
- 使用 theme-aware surface separation、全局可解析的 `--border-strong` 1px structure divider 与极弱顶部 inset highlight 建立层次。
- 将 toolbar vertical padding 从 `8px` 收敛为 `2px`，保留控件原有高度与点击热区。
- 移除整条 toolbar 的 `focus-within` accent border，焦点反馈继续由具体 interactive control 承担。
- normal toolbar 与 empty toolbar 复用同一无圆角视觉契约。

## 方案选项

- **Option A — Integrated window chrome（采用）**：full-width surface + bottom divider + inset highlight。titlebar 与工作区保持连续，层级来自结构而非容器卡片。
- **Option B — Square four-sided frame**：移除圆角但保留四边框。仍会产生 panel 内部“框中框”的分裂感。
- **Option C — Original single divider**：完全恢复原始样式。整体最统一，但缺少本次需要的轻微精致度提升。

选择 Option A，因为 desktop tool titlebar 的正确语义是 window chrome；它以最少视觉实体建立层级，并保持 Git tool 的工业化、紧凑感。

## 非目标

- 不重排 project/repository selectors、branch summary 或 action buttons。
- 不缩小 picker、action chip、close action 的既有尺寸与点击区域。
- 不增加 inset spacing、圆角 container、整栏 focus frame、响应式断点或 dropdown stacking context。
- 不引入新组件、design token、dependency 或 animation。
- 不修改 commit list、branch tree、changed-file tree 与 details pane。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `git-history-panel`: 扩展 Theme and Visual Consistency，要求 title layer 在 light/dark theme、empty state 与窄宽度下保持一体化结构层次且不裁剪交互浮层。

## Impact

- 样式：`src/styles/git-history.part1-shell.css`
- 行为规范：`openspec/specs/git-history-panel/spec.md` 的 change delta
- API / dependency / persistence：无变化

## 验收标准

- toolbar 在 light/dark theme 下均保持 full-width、zero-radius，并通过 surface、清晰可见的 1px 底部分隔线和顶部 inset highlight 形成层次。
- wide viewport 下 title band 使用紧凑垂直留白，整体高度约从 `47px` 降至 `35px`；控件本身尺寸不变。
- 底部分隔线 MUST 使用全局 theme 已定义的 border token，不得依赖局部作用域的 `--border-default`。
- title band 不使用四边 card frame 或 ambient shadow，不裁剪 project/repository picker dropdown。
- toolbar actions 的 hover/focus 可达性不变，整条 toolbar 不增加额外 focus border。
- normal 与 empty toolbar 使用相同 integrated chrome；narrow viewport 下现有 flex-wrap 继续生效。
- `npm run lint`、`npm run typecheck`、Git History focused tests 与 strict OpenSpec validation 通过。
