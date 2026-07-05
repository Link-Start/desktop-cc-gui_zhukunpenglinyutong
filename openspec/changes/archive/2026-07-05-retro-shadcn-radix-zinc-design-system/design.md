## Context

把客户端通用 UI primitives 收敛到 shadcn 默认 zinc 风格，并统一到 radix-backed components。

这次变更不是单纯换皮。它把很多分散的基础控件、focus ring、border、popover、tooltip、input/select/tabs 等交互基础层，统一到同一套 shadcn / radix / zinc 语义上。代码已经落地，但如果没有 OpenSpec，后续继续做设置页、Composer、Diff、Sidebar polish 时，很容易重新长出一批同义但不兼容的控件。

## Decisions

- `src/components/ui/**` 是唯一允许承载同类基础控件语义的 shared primitive 层。
- Feature 层可以组合 primitives，但不应复制一个同义 API 的 parallel primitive。
- 视觉 token 统一服务于 readability 和 affordance，不服务于“每个面板各自好看”。

## Risks And Guardrails

- 风险一：局部 feature 继续写自己的 input/select/tab 样式，导致 design-system drift。
- 风险二：theme token 迁移后，浅色/深色主题某些 focus 和 border 对比度下降。
- 防线：新增或重构 common controls 时先查 `src/components/ui/**`。

## Validation Strategy

- 本 change 不重新实现代码，只补齐 OpenSpec artifacts。
- Focused validation: `openspec validate retro-shadcn-radix-zinc-design-system --strict --no-interactive`。
- Workspace validation: `openspec validate --all --strict --no-interactive`。
- 业务代码已由既有 commits 落地；后续如要 archive，应在 archive note 中引用这些 commits 和人工验收事实。
