## Why

长回答流式输出时，最危险的性能反模式是每个 token 都重新扫描或重建整段历史。短内容看不出来，长内容会变成累计 O(L^2)，主线程被压死，用户看到卡顿、输入延迟、scroll lag。

既成事实是：thread reducer text merge 已有 fast path，Messages live window/render utils 降低全历史开销，heavy vendors 保持 lazy，lightweight/pure code block 场景会跳过 heavy-islands 每 token 重扫。

本 proposal 要把这个性能结论写成 contract：未来任何改动都不能把 streaming hot path 带回 full-history per-token work。已有 `enable-claude-lightweight-streaming-and-frame-attribution` 覆盖 Claude lightweight streaming，本 change 只补更广义的 merge/render performance。

## What Changes

- 消除 streaming text merge 的 O(L^2) 路径。
- 减少长 conversation streaming 期间 full-history work。
- 保持 heavy vendors lazy。
- 在 lightweight streaming / pure code block 场景跳过 heavy-islands 重扫。

## Scope / Impact

- Affected commits: `d0fc3feb`, `5f7ac804`, `f2683bf8`.
- Impact file/surface: `src/features/threads/hooks/threadReducerTextMerge.ts`
- Impact file/surface: `src/features/threads/hooks/useThreadsReducer.ts`
- Impact file/surface: `src/features/messages/components/**`
- Impact file/surface: `src/features/markdown/messageMarkdownHeavyIslands.ts`
- Impact file/surface: `vite.config.ts`

## Non-Goals

- 不重复覆盖 Claude lightweight streaming 主变更。
- 不改变 canonical transcript semantics。
- 不降低 final Markdown fidelity。

## Retroactive Note

这是 retroactive OpenSpec change。代码已经按上述 commits 落地，并且用户确认当前最新代码已测试、功能体验满意。本 change 的目标是把既成事实沉淀为可验证的 behavior contract，便于后续 sync / archive / regression review。
