## Context

`MessagesCore` 已提供 user-message anchor 列表、active anchor id 与 `requestScrollToAnchor`。当前 `MessagesAnchorRail` 使用 `useCollapsibleFloater`：hover 整条 rail 后渲染全部 anchor rows。CSS 将 rail 固定在右侧且只显示最多 10 个紧凑 dash。

用户确认的新 contract 是左侧全高 rail、单锚点 preview card、简易描述和边界保护。工作区同时存在未提交的 Messages scroll convergence 修改，因此实现必须避开滚动 controller、active-anchor 计算与 virtualization。

## Goals / Non-Goals

**Goals:**

- 在 component-local state 中完成 hover/focus preview selection。
- 按 user turn 顺序将 dash 从 rail 顶部紧凑排列，并用 bounded gap 控制垂直密度。
- bounded render 最多 32 个代表性 dash，并保留 active anchor。
- preview card 只展示一个 user turn 的 title 与 bounded description。
- 保持 click、keyboard、active state、responsive hide 与 reduced-motion contract。

**Non-Goals:**

- 不从 assistant/tool content 推断 summary 或 evidence。
- 不改变 anchor identity、scroll target、hydration priority 或 auto-follow。
- 不引入 portal、floating-position dependency、global state 或 persistence。

## Decisions

### Decision 1: 使用 component-local hovered/focused anchor

`MessagesAnchorRail` 维护 `previewAnchorId: string | null`。每个 dash 使用真实 `<button>`；`mouseenter` / `focus` 选择当前 anchor，rail `mouseleave` / button `blur` 清理。preview card 作为当前 anchor item 的 sibling 渲染，因此 DOM 中最多存在一个 card。

Alternative：继续使用 `useCollapsibleFloater` 控制整条 panel。该 hook 的 state 语义是 collapsed/expanded/pinned，不表达“哪一个 anchor”，会保留全部目录路径，因此不采用。

### Decision 2: 保留 bucket sampling，并使用紧凑 visible-row layout

使用原始 anchor index 分 32 个不重叠 bucket；每个 bucket 选择中位 anchor，active anchor 所在 bucket 必须选择 active anchor。采样结果保持原始顺序，但 dash 不再按全文百分比拉满 rail，而是从顶部使用 bounded gap 紧凑排列。active dash 默认只加深；只有 hover/focus 的 dash 横向拉长。

Alternative：渲染所有 anchors。极长历史会产生重叠 hit target 和无界 DOM，不满足边界要求。

Alternative：继续按原始 index 百分比分布。少量 user turns 会产生大段无意义空白，无法匹配参考图的紧凑阅读标尺，因此不采用。

### Decision 3: description 只来自 user message 原文

`MessagesCore` 将首个非空行作为 title；剩余 normalized text 截断为 bounded description。若没有剩余内容，card 仅显示 title。该映射保持 deterministic，不读取 assistant streaming rows。

Alternative：派生 assistant summary/evidence。此方案会把 anchor rail 绑定到 live output 与 semantic extraction，扩大 render 和 contract 风险，当前不采用。

### Decision 4: 用 visible-row placement classes 保护垂直边界

anchor 位于可见紧凑栈前部时 card 向下展开；当栈足够长且 anchor 位于尾部时向上展开；中间区域垂直居中。card width 同时受 conversation container 与 viewport max-width 约束。此任务不引入 floating engine。

Alternative：统一 `translateY(-50%)`。首尾 anchors 会让 card 越过顶部或底部。

### Decision 5: 使用 reference-calibrated compact visual tokens

参考图显示当前实现的 dash width、hover expansion、row pitch、preview offset、padding、radius 与 shadow 整体约放大一倍。采用 CSS-only calibration：普通 dash `6px × 2px`、hover/focus width `26px`、item height `8px`、固定 gap `2px`；preview left offset `36px`，并同步收紧 width、padding、radius 与 shadow。交互、DOM、sampling 与 placement 不变。

Alternative：只缩小 gap。该方案仍保留过长 dash 和过大的 preview card，视觉差异依旧明显，因此不采用。

Alternative：使用 `ResizeObserver` 动态计算所有尺寸。当前视觉预算固定且 anchors 已 bounded，引入 runtime measurement 没有工程收益，因此不采用。

### Decision 6: 使用 visible-index distance 形成局部凸起

复用 `previewAnchorId`，在 bounded `visibleAnchors` 中定位当前 hover/focus index。以该 index 为峰值，distance `0/1/2/3` 分别映射 `26px/20px/12px/8px`，其他 dash 保持 `6px`。pointer leave、blur 或 jump 清理 `previewAnchorId` 后，所有 proximity class 同步消失。

该映射只依赖最多 32 个 visible anchors，render 成本固定；无需新增 state、DOM measurement 或 dependency。preview 仍只渲染峰值 anchor 的单个 card。

Alternative：CSS `:has()` + sibling selector。向前邻居与多层级 selector 难维护，且兼容性和测试可读性更差，因此不采用。

Alternative：对单根 dash 使用 `scaleX()`。只能制造针刺式峰值，无法表达参考图中的连续局部轮廓，因此不采用。

## Risks / Trade-offs

- [Risk] 32 个 bucket 无法让超长会话的每个 user turn 都拥有独立 dash → 保持等距代表性采样并强制保留 active anchor；完整 transcript 仍可正常滚动。
- [Risk] description 可能包含 Markdown/path 文本且很长 → 只作为 plain text 渲染，并做字符上限与 CSS line clamp。
- [Risk] card 横向遮挡正文 → 采用 bounded width、单卡片和非 modal 交互；pointer 离开 rail/card 后立即关闭。
- [Risk] 与当前未提交的 `MessagesCore` scroll 修改冲突 → 仅修改 title derivation 与 anchor mapping 的局部行，提交前逐文件审查 diff。

## Migration Plan

1. 先更新 component 与 focused tests。
2. 更新 rail CSS，保留 compact-container hide 与 reduced-motion。
3. 执行 focused Vitest、lint、typecheck、large-file check 和 strict OpenSpec validation。
4. 回滚时还原 component/CSS/test/delta spec；没有数据迁移。

## Open Questions

无。用户已确认采用单目录项 + 简易描述，不展示全部目录。
