## Context

当前 Sidebar tree 仅根据 `threadParentById` 派生层级：`depth > 0` 即被渲染为 Subagent。`startFork()` 又无条件调用 `updateThreadParent(parent, [fork])`，导致用户 Fork 与真实 Subagent 共用同一 projection。Claude 还使用 `claude-fork:<parent>:<nonce>` 作为首次发送前的 provisional identity，因此 catalog reconciliation 若仅信任 disk/native catalog，会提前移除这个尚未落盘的可用会话。

## Goals / Non-Goals

**Goals:**

- 从写入源头隔离 user Fork 与 Subagent relationship。
- 让 Claude provisional Fork 在当前 runtime 内可见，直至 native identity migration。
- 保持真实 Subagent projection 与 UI 行为零回退。

**Non-Goals:**

- 不新增 relationship data model 或 fork-lineage UI。
- 不修改 engine/backend fork command。
- 不承诺未首次发送 Claude Fork 的跨应用重启 persistence。

## Decisions

### 1. User Fork 不写入 `threadParentById`

`threadParentById` 继续作为 Sidebar Subagent ownership projection。Composer `startFork()` 与幕布 message-tail `handleForkFromMessage()` 创建出的 user Fork 都是独立 conversation，只保留复制 history/title/active thread 所需状态；两个 entrypoint 均不得调用 `updateThreadParent()`。

Alternative：增加 `relationshipKind: "fork" | "subagent"`。该方案数据表达更完整，但需要迁移所有 relationship producer/consumer；当前产品不展示 Fork lineage，因此不采用。

### 2. 在 catalog reconciliation 边界识别 Claude Fork bootstrap identity

复用既有 `isClaudeSessionBootstrapThreadId()` / Claude Fork helper，不新增平行 prefix 判断。reconciliation 合并 authoritative catalog 时，保留 runtime 中尚未 canonicalize 的 bootstrap thread；完成 `renameThreadId` 后由 canonical row 自然接管。

Alternative：Fork 点击时立即调用 backend 创建空 native Claude session。Claude CLI contract 依赖 first prompt 执行 `--fork-session`，提前伪造 native identity 会破坏既有 contract，因此不采用。

### 3. 用互斥测试保护语义边界

测试同时断言：composer Fork 与 message-tail Fork 均不写 relationship；user Fork 为 top-level；real Subagent 为 child；Claude provisional refresh 后仍存在；canonical migration 不携带 Subagent relation。测试锁定所有 producer 与 projection 两端，避免 sibling entrypoint 再次漂移。

### 4. Claude message operation 显式区分 Fork 与 Rewind lifecycle

`mode: "messages-only" | "messages-and-code"` 只描述 history/code 的截断范围，不能表达用户是在执行 Fork 还是 Rewind。message-tail Fork 与 Rewind 虽然复用同一个 backend clone/truncate command，但 frontend completion lifecycle MUST 由独立的 `operation: "fork" | "rewind"` 决定。

- `operation: "fork"`：保留 parent，确保 canonical child thread 存在，设置 `fork-<parent title>`，激活并加载 child；不得 rename/hide/delete parent。
- `operation: "rewind"`：保持既有 replace-in-place lifecycle，包括 first-message destructive rewind 语义。
- 未提供 `operation` 时默认 `rewind`，保护现有内部调用方；所有用户可达入口显式传值，避免语义再次漂移。

Alternative：根据调用栈或 `mode` 推断。两个入口都可使用 `messages-only`，推断不具备互斥性，因此不采用。

## Risks / Trade-offs

- [Risk] catalog reconciliation 保留 provisional row 可能留下 stale runtime draft → 仅保留严格匹配 Claude bootstrap id 的 row，并沿用既有 draft lifecycle cleanup。
- [Risk] 删除 parent relation 后失去 UI 内 Fork lineage → 当前没有消费该 lineage 的正式产品能力；native engine history metadata 仍保留，不影响 backend audit。
- [Risk] 误伤真实 Subagent → 不修改 engine/runtime relationship producer 与 `ThreadList` tree rules，并运行既有 Subagent regression suite。
- [Risk] 复用 runtime action 时 Fork 再次误走 Rewind → operation discriminator 由两个 UI entrypoint 显式传递，并用 mutually exclusive action tests 锁定 parent preservation / deletion contract。

## Migration Plan

1. 移除 user Fork 的 generic relationship 写入。
2. 修正 catalog reconciliation 对 Claude bootstrap row 的保留逻辑。
3. 验证 identity migration 与真实 Subagent projection。
4. 将 Claude message operation completion lifecycle 按 Fork / Rewind 显式分流。
5. 回滚时可逐文件撤销 frontend diff；无 schema、storage 或 backend migration。

## Open Questions

无。未首次发送 Fork 的跨重启 draft persistence 留待独立需求评估。
