## Context

把 Composer 次级工具收纳到 “+” menu，并把 permission mode / reasoning depth / branch badge 放到更清晰的位置。

Composer 是最高频输入入口，任何按钮位置变化都不是小事。原先工具按钮分散在输入框周边，随着文件、技能、提示词、语音、模式选择等能力增加，主行变得拥挤。

## Decisions

- Primary row 只放会影响 next-turn behavior 的高频状态和 submit/stop。
- `+` menu 承载低频工具，但必须保持 reachable。
- Branch badge 是上下文提示，不与 submit/stop 争夺主操作位置。

## Risks And Guardrails

- 工具收纳后 discoverability 下降。
- 权限/推理深度状态不明显会导致用户错误提交。
- 防线：primary controls 必须 submit 前可见或一跳可达。

## Validation Strategy

- 本 change 不重新实现代码，只补齐 OpenSpec artifacts。
- Focused validation: `openspec validate retro-composer-tool-menu-and-primary-controls --strict --no-interactive`。
- Workspace validation: `openspec validate --all --strict --no-interactive`。
- 业务代码已由既有 commits 落地；后续如要 archive，应在 archive note 中引用这些 commits 和人工验收事实。
