## Context

Git History workbench 由 `.git-history-toolbar` 承载 title、workspace/repository picker、HEAD/branch summary 和 Git actions，同一 selector 也被 empty repository page 复用。首版使用 inset margin、四边框、9px radius 和 drop shadow，实机效果将 titlebar 误表达为独立 card，与下方三栏工作区产生视觉断层。picker menus 通过绝对定位展开，toolbar 也必须继续避免 clipping。

## Goals / Non-Goals

**Goals:**

- 通过单一 CSS selector 让 normal / empty toolbar 获得一致的 integrated window chrome。
- 使用既有 theme tokens 与 `color-mix()`，在 light/dark theme 下保持低对比度层次。
- 最大限度压缩 title band 的装饰性垂直留白，同时保留现有 control hit area。
- 保持现有 flex wrapping、focus path、hover actions 与 dropdown overlay 行为。
- 保持 edge-to-edge spacing，并将顶部占用高度收敛到由内部 controls 主导。

**Non-Goals:**

- 不改变 `GitHistoryPanelView` DOM 或组件 props。
- 不新增 breakpoint、JavaScript layout measurement 或 design token。
- 不增加 rounded container、ambient shadow 或整栏 focus frame。
- 不给 commit/detail panes 增加额外 frame。

## Decisions

### 1. Reuse `.git-history-toolbar` as an integrated title band

直接在现有 toolbar selector 上保持 edge-to-edge layout，以 full-width background、`border-bottom` 与 inset top highlight 建立层次。normal 与 empty state 自动共享契约，无需额外 wrapper。

Alternative：新增 `.git-history-title-frame` wrapper。它会扩大 DOM 与测试面，并再次强化独立容器语义，因此不采用。

### 2. Use structural separation, not a container frame

采用 `var(--border-strong)` 驱动的 1px theme-aware bottom divider、比工作区略亮一级的 surface 和极弱 top inset highlight。`--border-strong` 在 dark/light/system theme 中均有定义；不再使用仅在局部 scope 存在的 `--border-default`。同时明确移除 four-sided border、radius 与 outer shadow，让 titlebar 在视觉上直接属于 workbench。

Alternative：无圆角四边框仍会形成“框中框”；rounded card 已被实机反馈证明会造成分裂。

### 3. Preserve overlays and responsive wrapping

不设置 `overflow` 或新的 `position/z-index`。沿用 `.git-history-toolbar-left` 的 `flex-wrap`，将 toolbar padding 收敛为 `2px 8px`，保持 dropdown overlay 与 narrow viewport wrapping。

### 4. Keep focus feedback local to controls

删除 `.git-history-toolbar:focus-within` frame。project/repository picker、action chips 与 close control 继续使用各自既有 focus treatment，避免用户操作单个 control 时整条 titlebar 改色。

### 5. Compress container whitespace before control hit areas

toolbar 当前高度由约 `30px` 的 picker/action group 与 `8px` 上下 padding 共同形成。仅将 container padding 调整为 `2px 8px`，wide viewport 下整体高度约由 `47px` 收敛到 `35px`；不修改 picker、action chip 或 close action 的尺寸，避免用可用性换取密度。

Alternative：继续把 controls 从 `30px` 压到 `26px`。收益只有约 `4px`，但会缩小 pointer target 并扩大关联样式范围，因此不采用。

## Risks / Trade-offs

- [Risk] bottom divider 过强会再次割裂上下层 → 保持 1px，并使用 theme 的 `border-strong`，不叠加第二条 shadow line。
- [Risk] border token 未解析导致分割线消失 → 使用 dark/light/system theme 均定义的 `--border-strong`，并提供 neutral fallback。
- [Risk] inset highlight 在 light theme 不明显 → highlight 仅作为细节，不承担结构分隔职责。
- [Risk] empty toolbar 视觉漂移 → 不增加 empty-specific border override，仅复用共享 toolbar contract。
- [Risk] overlay 被 title band 裁剪 → 明确不设置 `overflow: hidden`。
- [Risk] 极限压缩导致 controls 贴边 → 保留 `2px` 上下 breathing room，不采用 zero-padding。

## Migration Plan

1. 更新 OpenSpec artifacts，撤销 rounded inset frame contract。
2. 更新 `.git-history-toolbar`，恢复 integrated title band 并压缩 container padding。
3. 运行 focused Git History tests、lint、typecheck 与 strict OpenSpec validation。
4. 若视觉不符合预期，可回退单个 CSS hunk；没有数据、API 或 state migration。

## Open Questions

无。用户已确认采用 full-width、zero-radius 的 integrated window chrome。
