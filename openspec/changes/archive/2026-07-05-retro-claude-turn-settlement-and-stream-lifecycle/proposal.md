## Why

Claude runtime 的 turn lifecycle 是高风险链路。用户看到“生成中”是否结束，取决于 result event、stderr tail、process group cleanup、frontend live state 多个环节。任何一个环节无限等待，UI 就会卡在 generating。

既成事实是：`/context` command usage probe 已从热路径移除；收到 Claude `result` 后按 bounded grace window 结算；必要时强杀残留进程组；result 后 stderr drain 增加 timeout；实时回合生命周期被加固。

这不是 UI polish，而是 backend/runtime contract。OpenSpec 必须写清楚：不能为了尾部 stderr 或残留进程让回合无限不结束，也不能过早丢弃 result 后的合理尾部事件。

## What Changes

- 移除 Claude `/context` usage probe。
- 收到 result 后进行 bounded grace settlement。
- 对 result 后 stderr tail 执行 bounded drain。
- 对残留 process group 进行 cleanup。
- 同步加固 frontend realtime turn lifecycle state。

## Scope / Impact

- Affected commits: `49641b9a`, `a089520d`, `175d6945`, `16e88157`.
- Impact file/surface: `src-tauri/src/engine/claude.rs`
- Impact file/surface: `src-tauri/src/engine/claude/lifecycle.rs`
- Impact file/surface: `src-tauri/src/engine/claude/user_input.rs`
- Impact file/surface: `src-tauri/src/engine/claude/tests_*`
- Impact file/surface: `src/features/messages/**`
- Impact file/surface: `src/features/threads/**`

## Non-Goals

- 不改变 Claude CLI protocol。
- 不引入新的 usage probe command。
- 不改变 user message submit API。

## Retroactive Note

这是 retroactive OpenSpec change。代码已经按上述 commits 落地，并且用户确认当前最新代码已测试、功能体验满意。本 change 的目标是把既成事实沉淀为可验证的 behavior contract，便于后续 sync / archive / regression review。
