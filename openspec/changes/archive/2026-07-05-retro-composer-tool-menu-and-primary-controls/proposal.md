## Why

Composer 是最高频输入入口，任何按钮位置变化都不是小事。原先工具按钮分散在输入框周边，随着文件、技能、提示词、语音、模式选择等能力增加，主行变得拥挤。

既成事实是：低频工具已经收纳进 “+” menu/dropdown；permission mode 和 reasoning depth 被提升到 primary row；branch badge 作为上下文 metadata 出现在 Composer；同时输入框和消息时间线 spacing 被打磨。

OpenSpec 需要明确：收纳工具不是隐藏能力，主控制行必须让用户在 submit 前看见会影响下一轮行为的关键状态。

## What Changes

- 新增 `ComposerBranchBadge`。
- 把 secondary tools 和 shortcut actions 收纳到 `+` menu。
- 把 permission mode 和 reasoning depth 暴露在 primary row。
- 打磨 ChatInputBox layout、toolbar、selectors、HomeChat spacing。

## Scope / Impact

- Affected commits: `95bc726a`, `bd00e490`, `524bcf9a`, `d3ca82fa`.
- Impact file/surface: `src/features/composer/components/ChatInputBox/**`
- Impact file/surface: `src/features/composer/components/Composer.tsx`
- Impact file/surface: `src/features/composer/components/ComposerBranchBadge.tsx`
- Impact file/surface: `src/features/home/components/HomeChat.tsx`
- Impact file/surface: `src/styles/home-chat.css`
- Impact file/surface: `src/features/composer/components/ChatInputBox/styles/**`

## Non-Goals

- 不改变 message submit protocol。
- 不新增 provider 配置模型。
- 不移除 existing shortcut actions。

## Retroactive Note

这是 retroactive OpenSpec change。代码已经按上述 commits 落地，并且用户确认当前最新代码已测试、功能体验满意。本 change 的目标是把既成事实沉淀为可验证的 behavior contract，便于后续 sync / archive / regression review。
