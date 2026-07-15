# claude-fork-session-support Specification

## Purpose

Defines the claude-fork-session-support behavior contract, covering Claude Fork Session MUST Create A New Session From A Historical Parent.
## Requirements
### Requirement: Claude Fork Session MUST Create A New Session From A Historical Parent

系统 MUST 通过 Claude CLI 的 fork session contract 从既有历史 session 创建一条新的子会话分支，而不是复用原 session identity。

#### Scenario: fork from history creates a distinct child session

- **WHEN** 用户从 Claude 历史会话发起 fork thread
- **THEN** 系统 MUST 以目标历史 session 作为 fork parent
- **AND** Claude CLI MUST 生成一个新的 session identity
- **AND** 该 child session MUST 与 parent session 区分为不同的 conversation truth

#### Scenario: fork does not rewrite the parent session

- **WHEN** fork session 成功创建
- **THEN** 原历史 session MUST 保持不变
- **AND** 系统 MUST NOT 通过 fork 操作改写 parent 的历史内容、identity 或恢复状态

#### Scenario: pending continuation guard does not block fork bootstrap

- **WHEN** 用户从 finalized parent `claude:<parentSessionId>` 创建 fork thread
- **AND** fork thread 尚未 finalized 为 child native session
- **THEN** 系统 MUST still send the first fork request with `forkSessionId=<parentSessionId>`
- **AND** 系统 MUST NOT treat the missing child `nativeResumeSessionId` as a reason to block the fork first-send

### Requirement: Claude Fork Session MUST Be Routed Through Engine Command Building

系统 MUST 在 Claude engine command building 阶段传递 fork session 参数，并由 backend 负责执行 `--resume <parent-session-id> --fork-session` command contract。

#### Scenario: engine command includes fork session argument

- **WHEN** frontend 请求 Claude fork session
- **THEN** backend command builder MUST 为 Claude CLI 追加 `--resume <parent-session-id> --fork-session`
- **AND** frontend MUST NOT 自行伪造新 session 映射来代替 command contract

#### Scenario: invalid fork session input is rejected explicitly

- **WHEN** fork session 参数缺失、空值或不符合允许格式
- **THEN** 系统 MUST 显式拒绝该 fork 请求
- **AND** 系统 MUST NOT 静默降级成普通 resume 或创建无来源的新会话

#### Scenario: unsupported CLI fork contract is rejected explicitly

- **WHEN** 当前 Claude CLI 版本未提供已验证的 fork session contract
- **THEN** 系统 MUST 显式拒绝该 fork 请求
- **AND** 系统 MUST NOT 退化成客户端伪造 fork session

### Requirement: Claude Fork Session MUST Be Provider Scoped

系统 MUST 只在 Claude provider / Claude engine 路径下启用 fork session contract，其他 provider MUST 保持原有会话行为。

#### Scenario: non-Claude provider does not expose fork session contract

- **WHEN** 当前 provider 不是 Claude
- **THEN** 系统 MUST NOT 发送 Claude-specific fork session 参数
- **AND** 系统 MUST NOT 通过 Claude fork contract 改变其他 provider 的 session 行为

#### Scenario: fork action remains visible only when provider supports it

- **WHEN** 当前 UI 处于不支持 Claude fork session 的 provider
- **THEN** fork thread 入口 MUST 保持隐藏、禁用或走既有语义
- **AND** 系统 MUST NOT 让用户误以为所有 provider 都支持历史分叉

#### Scenario: composer fork quick action creates a fork without sending content

- **WHEN** 用户在 Claude 或 Codex composer 配置面板点击 Fork quick action
- **THEN** 系统 MUST 触发与裸 `/fork` 等价的 fork thread 行为
- **AND** 系统 MUST 切换到 fork 后的新线程等待用户后续输入
- **AND** 系统 MUST NOT 自动发送额外消息内容

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

