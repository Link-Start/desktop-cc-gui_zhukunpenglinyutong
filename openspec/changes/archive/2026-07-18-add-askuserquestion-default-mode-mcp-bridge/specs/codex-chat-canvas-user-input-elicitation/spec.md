## ADDED Requirements

### Requirement: AskUserQuestion MUST Be Reachable In Non-Plan Modes Via An In-Process MCP Server

系统 MUST 在非 plan 模式（`default` / `acceptEdits`）下通过一个进程内 MCP 服务器暴露 `AskUserQuestion` 工具，使 Claude 会话可以在 turn 进行中发起结构化提问，而不是仅在 plan 模式下经由原生 plan-gated 工具才能提问。

The Claude CLI only exposes its native `AskUserQuestion` tool when running in plan
mode; in `default` / `acceptEdits` the native tool is permission-gated, so a
mid-turn structured ask is otherwise impossible. The client MUST start an
in-process MCP server that re-exposes the capability as an allowed MCP tool.

#### Scenario: non-plan mode wires the in-process MCP tool

- **WHEN** 客户端为一个 `claude` 会话构建 CLI 命令
- **AND** 该会话运行时模式不是 plan 模式
- **THEN** 命令 MUST 通过 `--mcp-config` 注入进程内 AskUserQuestion MCP 服务器
- **AND** 命令 MUST 将该服务器的工具名显式加入允许列表（allowed tools）
- **AND** 系统 MUST NOT 传入 `--strict-mcp-config`，以免屏蔽用户自有的 MCP 服务器

#### Scenario: plan mode does not double-wire the MCP tool

- **WHEN** 客户端为一个 `claude` 会话构建 CLI 命令
- **AND** 该会话运行时模式为 plan 模式
- **THEN** 系统 MUST 依赖 CLI 原生 `AskUserQuestion` 工具
- **AND** 系统 MUST NOT 额外注入进程内 MCP AskUserQuestion 工具

#### Scenario: MCP-origin ask renders and settles through the shared user-input card

- **WHEN** 进程内 MCP 服务器收到一个 AskUserQuestion 调用
- **THEN** 系统 MUST 复用既有 `RequestUserInput` 交互卡片路径展示该提问
- **AND** 用户提交后系统 MUST 将答案作为 MCP `tool_result` 返回给发起该调用的 live turn
- **AND** 该往返 MUST NOT 依赖 kill/resume，当前 turn MUST 继续执行

### Requirement: AskUserQuestion MCP Calls MUST Survive Answers Slower Than The CLI Default Fetch Timeout

系统 MUST 在注入 AskUserQuestion MCP 工具时提高 CLI 的 MCP 工具调用抓取超时，使用户耗时超过 CLI 默认 60s 的回答不会被 CLI 提前放弃并作为 timeout 返回给模型。

The Claude CLI defaults its per-request MCP tool-call fetch timeout to 60s for
HTTP MCP servers, but an AskUserQuestion blocks on a human for up to the server's
own (much longer) window. Without raising the CLI timeout, any answer taking
longer than 60s is abandoned by the CLI and lost.

#### Scenario: tool timeout is raised when the ask is wired

- **WHEN** 客户端为一个 `claude` 会话注入 AskUserQuestion MCP 工具
- **THEN** 命令环境 MUST 设置 `MCP_TOOL_TIMEOUT` 为一个不短于服务器等待窗口的值（例如 300000 毫秒）
- **AND** 一个耗时超过 60s 才提交的回答 MUST 仍被正确送达发起该调用的 turn

#### Scenario: an explicit user override is respected

- **WHEN** 环境中已存在用户设置的 `MCP_TOOL_TIMEOUT`
- **THEN** 系统 MUST NOT 覆盖该用户显式值

### Requirement: A Pending AskUserQuestion MUST Hold The Composer Send Queue For Its Thread

系统 MUST 在某线程存在待回答的 AskUserQuestion / RequestUserInput 卡片时，保留（而非清空）该线程的 Composer 发送队列，使排队消息不会被当作新 turn 发出而令待处理提问失去归属。

While a dialog is open the CLI turn is blocked awaiting the answer; flushing the
queue would strand the answer and start unrelated fresh turns.

#### Scenario: queued messages are held while an ask is pending for the active thread

- **WHEN** 活动线程存在一个待回答的 AskUserQuestion 卡片
- **AND** 用户发送或已排队一条消息
- **THEN** 系统 MUST 将该消息保留在队列中而不是立即作为新 turn 发出
- **AND** 系统 MUST 在提问结算（提交 / skip / stale settlement）后恢复正常的队列 flush

#### Scenario: pending detection is scoped by workspace and thread

- **WHEN** 系统判断当前线程是否存在待回答提问
- **THEN** 判断 MUST 匹配 `workspace_id`
- **AND** 空 `thread_id` MUST 视为当前线程
- **AND** 另一线程的待回答提问 MUST NOT 触发当前线程的队列保留
