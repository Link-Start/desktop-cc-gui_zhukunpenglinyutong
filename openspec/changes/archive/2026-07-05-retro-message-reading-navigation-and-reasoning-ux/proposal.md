## Why

长对话阅读不是简单把消息排出来。用户需要知道 turn boundary 在哪里、如何跳转到用户消息、reasoning 是否连续、图片是否可检查。过去这些能力在短时间内经历了添加、重做、移除和再设计，如果不写 OpenSpec，后续很难判断“哪个行为才是产品接受的事实”。

既成事实是：turn boundary 已迁移到 marker-style separator；anchor rail 经过 add/rework/remove 的迭代；same-segment thinking runs 被合并以降低碎片化；deferred Claude images 可以点击打开 lightbox。

本 proposal 的核心不是描述每个 CSS 细节，而是约束：导航不能改变 transcript order，reasoning 合并不能丢内容，图片预览必须可检查。

## What Changes

- 更新 turn boundary presentation。
- 迭代 user-message anchor rail / outline navigation。
- 合并 same-segment thinking runs。
- 为 deferred Claude image 增加 lightbox click behavior。

## Scope / Impact

- Affected commits: `7a71fef5`, `8049be76`, `f763bbf7`, `ee3f050d`, `63e8bd59`, `10bf1125`.
- Impact file/surface: `src/features/messages/components/Messages*.tsx`
- Impact file/surface: `src/features/messages/components/MessagesAnchorRail.tsx`
- Impact file/surface: `src/features/messages/components/messagesReasoning.ts`
- Impact file/surface: `src/features/messages/components/messagesLiveWindow.ts`
- Impact file/surface: `src/styles/messages.*.css`
- Impact file/surface: `src/styles/themes.*.css`

## Non-Goals

- 不改变 engine event protocol。
- 不改变 thread reducer canonical item shape。
- 不强制所有 engines 使用同一种 reasoning label。

## Retroactive Note

这是 retroactive OpenSpec change。代码已经按上述 commits 落地，并且用户确认当前最新代码已测试、功能体验满意。本 change 的目标是把既成事实沉淀为可验证的 behavior contract，便于后续 sync / archive / regression review。
