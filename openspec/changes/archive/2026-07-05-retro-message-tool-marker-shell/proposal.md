## Why

AI 编码客户端里，tool block 不是装饰卡片，而是用户判断 AI 是否读文件、改文件、跑命令、调用 MCP 的证据面。之前每类 tool block 各自维护外壳，尺寸、折叠、状态表达容易分叉。

既成事实是：`ToolMarkerShell` 已经成为工具块共享外壳，marker 尺寸和 shadcn-style 折叠壳已经统一，同时修复了 timeline virtual blank row 被工具卡撑高的问题。

补 OpenSpec 的重点是防止后续新增 tool block 再绕开共享外壳，或者为了视觉紧凑而隐藏关键 evidence。

## What Changes

- 新增 shared marker primitive 和 `ToolMarkerShell`。
- 迁移 Bash/Edit/Read/Search/MCP/Generic tool blocks 到共享 shell。
- 统一 collapsed/expanded chrome、marker size、status summary。
- 修复 MessagesTimeline 中虚拟空行被 tool card layout 影响的问题。

## Scope / Impact

- Affected commits: `dd5dfa77`, `144563c2`, `c636c564`.
- Impact file/surface: `src/features/messages/components/toolBlocks/**`
- Impact file/surface: `src/components/ui/marker.tsx`
- Impact file/surface: `src/styles/tool-blocks.css`
- Impact file/surface: `src/styles/tool-call-block.css`
- Impact file/surface: `src/features/messages/components/MessagesTimeline.tsx`

## Non-Goals

- 不改变 tool event schema。
- 不改变 backend command execution。
- 不删除任何 tool-specific business semantics。

## Retroactive Note

这是 retroactive OpenSpec change。代码已经按上述 commits 落地，并且用户确认当前最新代码已测试、功能体验满意。本 change 的目标是把既成事实沉淀为可验证的 behavior contract，便于后续 sync / archive / regression review。
