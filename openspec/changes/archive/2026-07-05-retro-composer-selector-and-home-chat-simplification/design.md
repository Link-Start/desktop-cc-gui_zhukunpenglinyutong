## Context

重构 Mode/Model/Reasoning selectors，引入 command/dialog primitives，并移除 HomeChat 专用 virtualization。

Composer selector 是用户切换模型、模式、reasoning 的关键入口。之前 selector 和 HomeChat virtualization 都带有局部复杂度：selector 需要更一致的 keyboard/pointer 行为，HomeChat 则不一定需要为有限内容承担 virtualizer 的测量复杂度。

## Decisions

- Selector 使用 shared command/dialog 语义保持一致交互。
- HomeChat 不承担长历史 timeline virtualization。
- 长对话性能继续由 Messages timeline 和 render performance changes 负责。

## Risks And Guardrails

- HomeChat 如果未来承载大量内容，简单渲染可能不够。
- Selector 重构可能破坏 keyboard navigation。
- 防线：HomeChat 内容规模扩张时必须重新评估 virtualization。

## Validation Strategy

- 本 change 不重新实现代码，只补齐 OpenSpec artifacts。
- Focused validation: `openspec validate retro-composer-selector-and-home-chat-simplification --strict --no-interactive`。
- Workspace validation: `openspec validate --all --strict --no-interactive`。
- 业务代码已由既有 commits 落地；后续如要 archive，应在 archive note 中引用这些 commits 和人工验收事实。
