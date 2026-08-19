## ADDED Requirements

### Requirement: Shared-owned file UUID parents hide sidebar children

当 child 的 authoritative parent 是 Shared 协议 owner 的 **文件 sessionId**（Claude `{fileUuid}` / `claude:{fileUuid}` / `subagent:{fileUuid}:…`），即使该 parent 不在当前 binding `nativeThreadIds` 中，侧栏 MUST 仍将其视为 Shared-owned pup 并隐藏。系统 MUST NOT 因 parent 不在可见线程列表而把 child 升为根。

#### Scenario: orphaned claude subagent of omitted owner is not promoted

- **WHEN** parent `{fileUuid}.jsonl` 因 MOSSX 协议被 Index omit / live list 丢弃
- **AND** child `parentSessionId` 为该 `{fileUuid}`
- **THEN** 侧栏 MUST NOT 将该 child 升为根
- **AND** MUST NOT 仅因 parent 不在当前 `threads` 集合而展示它

### Requirement: Native Codex TUI children remain a visible tree

Codex `thread_spawn.parent_thread_id` 指向用户自己的 TUI / Desktop 会话时，侧栏 MUST 继续按 parent-child 树展示。系统 MUST NOT 把「有 thread_spawn」或「昵称是希腊名」当成 Shared hide 条件。

#### Scenario: local socrates remains under desktop parent

- **WHEN** child `01a00d8f-7e8d-7481-bb59-9d3f79e4b51b` 的 `parent_thread_id` 为 `01a00d6c-205e-7492-b344-dccefed9909d`
- **AND** 该 parent 不是 Shared-owned
- **THEN** 侧栏 MUST 展示 Socrates 行并挂在该 parent 下

#### Scenario: local singer remains under tui parent

- **WHEN** child `019fc810-0a87-7542-8cf3-5a70454f2fa4` 的 `parent_thread_id` 为 `019fc7da-75f2-73a3-8793-9a8705e33a18`
- **AND** 该 parent 不是 Shared-owned
- **THEN** 侧栏 MUST 展示 Singer 行并挂在该 parent 下
