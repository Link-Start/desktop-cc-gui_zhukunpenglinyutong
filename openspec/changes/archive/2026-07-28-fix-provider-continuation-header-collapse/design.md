## Context

`ProviderContinuationContextCard` 作为 `timelineLeadingNode` 直接渲染在 `.messages` scroller
顶部，并使用原生 `<details>/<summary>` 提供折叠。Messages 的吸底与浏览器 scroll anchoring
会在内容高度接近 viewport 或展开详情时保持底部位置，因此 metadata row 的顶部可能移动到
Canvas chrome 下方。结果是折叠态只剩边框、展开态只剩 body，`summary` 无法再次点击。

约束：

- 必须继续复用既有 timeline-leading slot。
- 不得改动 Messages grouping、streaming 或全局 auto-scroll。
- 必须保留原生 keyboard-accessible `<details>` 语义。

## Goals / Non-Goals

**Goals:**

- 折叠和展开时都保持 metadata header 完整可见、可点击。
- 不依赖额外 React state 或 imperative scroll。
- 保持 source navigation 和 missing-source 语义不变。

**Non-Goals:**

- 不重构 Messages scroll anchoring。
- 不修改 continuation backend/catalog。
- 不将该行为泛化为新的 shared banner abstraction。

## Decisions

### 1. 在既有 scroller 内使用 sticky metadata surface

给 `<details>` 增加 feature-scoped class，并复用现有 Tailwind utilities 设置
`position: sticky`、明确的 `top`、`z-index` 和不透明 theme background。元素仍保留在普通
文档流中，但滚动锚定或展开高度变化不会把 `summary` 推入顶栏遮挡区。

备选方案：

- `scrollIntoView()`：只能在 toggle 后补救，首次折叠态仍可能被裁剪，并会主动改变用户滚动位置。
- 修改全局 auto-scroll：影响所有 Messages，范围和回归风险远高于单一 metadata row。

### 2. 保持原生 `<details>` 为唯一展开状态源

不引入 controlled React state。原生 toggle 已提供 mouse/keyboard 语义；问题属于布局可达性，
而非状态同步。

### 3. 用 focused DOM 与 class contract 锁定回归

组件测试覆盖 collapsed → expanded → collapsed，并断言 feature class 存在。该测试不模拟
浏览器完整布局，但会锁定可逆交互及 sticky 样式入口；人工 viewport smoke 负责验证真实遮挡。

## Risks / Trade-offs

- [Risk] sticky row 在滚动时覆盖下方消息 → 使用紧凑高度、不透明 surface 与受控 `z-index`；
  其定位只在 `.messages` scroller 内生效。
- [Risk] Tailwind utility 变更后布局意图难以单测 → 使用稳定 feature-scoped class 并在 focused
  test 中锁定关键 utility contract。
- [Risk] top offset 与主题不一致 → 使用 scroller 内部小间距和现有 theme tokens，不写死前景色。

## Migration Plan

1. 添加 feature class 与 sticky utility contract。
2. 扩充 focused component test。
3. 运行 focused Vitest、typecheck、lint 和 OpenSpec strict validation。
4. 回滚时删除 scoped CSS/class/test 增量；无数据迁移。

## Open Questions

无。问题边界和最小实现已由现有 DOM、截图及 scroll anchoring 行为确定。
