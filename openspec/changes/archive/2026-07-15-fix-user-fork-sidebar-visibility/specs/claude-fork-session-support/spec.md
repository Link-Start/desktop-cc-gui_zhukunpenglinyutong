## ADDED Requirements

### Requirement: Claude User Fork MUST Remain A Visible Independent Sidebar Session

系统 MUST 将用户主动创建的 Claude Fork 投影为独立顶层 conversation，而不是 Subagent child；在 native child session 尚未创建时，provisional Fork MUST 在当前 runtime 的 Sidebar catalog reconciliation 中保持可见。

#### Scenario: bare fork is immediately visible before first send
- **WHEN** 用户从 finalized Claude parent 创建 Fork 且尚未发送第一条消息
- **THEN** Sidebar MUST 立即显示该 `claude-fork:*` provisional thread 为顶层会话
- **AND** 该会话 MUST NOT 显示 `子代理` 标签或依赖 parent expansion 才可见

#### Scenario: provisional fork survives runtime catalog refresh
- **WHEN** workspace catalog refresh 尚未从 disk/native history 找到 provisional Claude Fork
- **THEN** reconciliation MUST 保留当前 runtime 中有效的 `claude-fork:*` row
- **AND** 系统 MUST NOT 将该行为解释为跨应用重启 persistence

#### Scenario: native child identity migration preserves independent visibility
- **WHEN** 首次发送成功并将 `claude-fork:*` identity 迁移为 `claude:<childSessionId>`
- **THEN** title、conversation items 与 active state MUST 迁移到 canonical thread
- **AND** canonical thread MUST 继续作为顶层会话且 MUST NOT 获得 Subagent relationship

#### Scenario: message-tail fork preserves parent lifecycle
- **WHEN** 用户从 Claude 幕布 message-tail 执行 Fork
- **THEN** frontend MUST 保留 parent thread 与其 title mapping、disk session 和 loaded state
- **AND** frontend MUST 创建、命名、激活并加载 backend 返回的 canonical child thread
- **AND** frontend MUST NOT rename、hide 或 delete parent

#### Scenario: first-message fork remains non-destructive
- **WHEN** 用户从 Claude conversation 的第一条 history message 执行 Fork
- **THEN** 系统 MUST 调用既有 backend fork command 创建 child
- **AND** 系统 MUST NOT 将 Fork 降级为删除 parent 的 first-message Rewind

#### Scenario: rewind retains destructive replacement semantics
- **WHEN** 用户从 Rewind 入口执行 Claude message operation
- **THEN** frontend MUST 继续使用既有 replace-in-place lifecycle
- **AND** Fork lifecycle 的 parent-preservation rules MUST NOT 改变 Rewind 行为
