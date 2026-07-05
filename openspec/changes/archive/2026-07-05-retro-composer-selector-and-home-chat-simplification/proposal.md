## Why

Composer selector 是用户切换模型、模式、reasoning 的关键入口。之前 selector 和 HomeChat virtualization 都带有局部复杂度：selector 需要更一致的 keyboard/pointer 行为，HomeChat 则不一定需要为有限内容承担 virtualizer 的测量复杂度。

既成事实是：`command.tsx` 和 `dialog.tsx` primitives 已加入，Mode/Model/Reasoning selector 已重构，`HomeChatVirtualization` 已删除，相关交互测试同步更新。

这个 retro proposal 记录一个重要判断：HomeChat 是首页轻量入口，不是长对话 timeline；减少不必要 virtualization 是降低系统复杂度，而不是放弃长列表性能。

## What Changes

- 新增 command/dialog shared primitives。
- 重构 `ModeSelect`、`ModelSelect`、`ReasoningSelect`。
- 删除 `HomeChatVirtualization`。
- 更新 HomeChat 和 selector tests。

## Scope / Impact

- Affected commits: `37cb6307`.
- Impact file/surface: `src/components/ui/command.tsx`
- Impact file/surface: `src/components/ui/dialog.tsx`
- Impact file/surface: `src/features/composer/components/ChatInputBox/selectors/**`
- Impact file/surface: `src/features/home/components/HomeChat.tsx`

## Non-Goals

- 不改变 full conversation timeline virtualization strategy。
- 不改变 model/provider catalog backend。
- 不改变 HomeChat submit contract。

## Retroactive Note

这是 retroactive OpenSpec change。代码已经按上述 commits 落地，并且用户确认当前最新代码已测试、功能体验满意。本 change 的目标是把既成事实沉淀为可验证的 behavior contract，便于后续 sync / archive / regression review。
