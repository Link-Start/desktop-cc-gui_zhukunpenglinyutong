## Context

`.main .messages` 使用 `margin-top: calc(-1 * var(--main-topbar-height))` 将滚动面延伸到共享
topbar 背后；普通 timeline 通过 `.messages-full` 的对应 `padding-top` 恢复安全区。
`timelineLeadingNode` 位于 `.messages-full` 外，因此 continuation row 必须自行补偿 topbar。
上一轮 `top-3` 只相对被上移后的 scrollport 定位，实际仍落在 chrome 下方。

## Goals / Non-Goals

**Goals:**

- 使用既有 `--main-topbar-height` 建立正确的 sticky safe offset。
- collapsed 和 expanded 状态都保留可见、可操作 summary。
- 将来源导航降为 icon-only action，保留完整 accessibility。

**Non-Goals:**

- 不修改 `.main .messages` 或 `.messages-full` 的全局布局。
- 不新增 React state、tooltip dependency 或 shared abstraction。
- 不改变 source navigation callback。

## Decisions

### 1. Sticky top 使用主顶栏高度 contract

组件采用 `top-[calc(var(--main-topbar-height)+12px)]`。`44px` 等 fallback 不在组件重复硬编码，
由 `base.css` 的 `--main-topbar-height` single source of truth 提供。

备选：给 `timelineLeadingNode` 新增 wrapper 并复制 `.messages-full` padding。该方案会改变 slot DOM
contract，并可能影响其他未来 leading node；本次只修 continuation row，不扩张边界。

### 2. 保留 semantic button，仅移除 button chrome

来源 action 继续使用 `<button type="button">`，显示 Arrow icon；通过 utility 覆盖全局 button
padding/border/background，提供固定 28px hit area、hover/focus surface、`aria-label` 和 `title`。

备选：裸 SVG 加 click handler。该方案破坏 keyboard、disabled 和 accessible name，拒绝。

### 3. Tests 锁定因果 contract

focused test 不再只断言泛化 `top-3`，而是断言包含 `--main-topbar-height` 的 offset，并断言 action
无可见 text、仍可按 accessible name 找到和触发。

## Risks / Trade-offs

- [Risk] Tailwind arbitrary calc 未生成 → class 为静态字符串，可由 Tailwind scanner 收集；focused
  test 锁定字符串，typecheck/build path 保持现有策略。
- [Risk] icon-only action 不易发现 → 保留 `title` tooltip、hover/focus surface 和返回方向 icon。
- [Risk] 28px target 偏紧凑 → metadata row 属桌面精简 chrome；保持 28px，不缩到纯 glyph 尺寸。

## Migration Plan

1. 修正 sticky top utility。
2. 收敛来源 action markup/style。
3. 更新 focused tests。
4. 运行质量门禁、sync spec、archive。

回滚仅涉及组件 class/markup 和 tests，无数据迁移。

## Open Questions

无。
