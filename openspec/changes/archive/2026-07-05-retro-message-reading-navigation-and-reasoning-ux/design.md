## Context

记录 turn boundary、anchor rail/outline、thinking run 合并、deferred Claude image lightbox 等阅读 UX 变更。

长对话阅读不是简单把消息排出来。用户需要知道 turn boundary 在哪里、如何跳转到用户消息、reasoning 是否连续、图片是否可检查。过去这些能力在短时间内经历了添加、重做、移除和再设计，如果不写 OpenSpec，后续很难判断“哪个行为才是产品接受的事实”。

## Decisions

- Navigation aid 只移动 viewport，不改变 canonical message order。
- Reasoning 合并是 presentation normalization，不丢原始语义。
- Deferred media 应提供 inspectable preview，而不是只显示不可操作占位。

## Risks And Guardrails

- 导航 UI 可能遮挡正文。
- Reasoning 合并可能误伤不同 segment。
- 防线：合并必须 scoped to same-segment，且 tests 覆盖 turn boundaries/reasoning render。

## Validation Strategy

- 本 change 不重新实现代码，只补齐 OpenSpec artifacts。
- Focused validation: `openspec validate retro-message-reading-navigation-and-reasoning-ux --strict --no-interactive`。
- Workspace validation: `openspec validate --all --strict --no-interactive`。
- 业务代码已由既有 commits 落地；后续如要 archive，应在 archive note 中引用这些 commits 和人工验收事实。
