# claude-provider-management Specification (delta: MODIFIED)

## MODIFIED Requirements

### Requirement: Claude Provider MUST Take Effect Via Per-Turn Launch Configuration

绑定 managed provider 的 Claude 会话 MUST 通过 spawn 时的 normalized environment 与 command-line settings override 使供应商生效，而非写入全局 settings.json。

#### Scenario: managed provider env is injected per turn

- **WHEN** 绑定 managed provider 的 Claude thread 发送消息
- **THEN** 后端 MUST 从 `~/.ccgui/config.json` 的 `claude.providers[id].settingsConfig.env` 解析键值对
- **AND** MUST 在该 turn 的 `claude` 进程中通过 `cmd.env` 注入全部键值（含 `ANTHROPIC_BASE_URL` / `ANTHROPIC_AUTH_TOKEN` / `ANTHROPIC_API_KEY` 等，不过滤键名）

#### Scenario: parent routing env is cleared before provider env apply

- **WHEN** 绑定 managed provider 的 Claude thread 发送消息
- **THEN** 后端 MUST 先清除 child 进程中的 Claude provider routing 环境键（`ANTHROPIC_API_KEY` / `ANTHROPIC_AUTH_TOKEN` / `ANTHROPIC_BASE_URL` / `ANTHROPIC_MODEL` / `ANTHROPIC_DEFAULT_*` / `ANTHROPIC_REASONING_MODEL` / `CLAUDE_CODE_SUBAGENT_MODEL` / `CLAUDE_CODE_USE_*` 等既有 routing 列表）
- **AND** 再写入当前 profile 的 normalized env
- **AND** MUST NOT 让父进程残留的 model 槽（如 `k3`）在缺失 profile 键时继续生效

#### Scenario: command-line settings override global settings.json

- **WHEN** 全局 `~/.claude/settings.json` 的 `env` 块与绑定 provider 的 `settingsConfig.env` 存在相同键
- **THEN** backend MUST 为该 turn 物化 private settings override，并通过 `--settings` 传给 Claude Code
- **AND** override MUST 与 process env 使用同一份 normalized provider environment
- **AND** turn 结束后 MUST 清理 private settings artifact

#### Scenario: missing provider fails the send with a clear error

- **WHEN** 绑定指向的 provider id 在 `~/.ccgui/config.json` 中已不存在
- **THEN** 该次发送 MUST 以包含 provider 标识的错误失败
- **AND** MUST NOT 静默回退到其他供应商

#### Scenario: --model uses provider-scoped runtime not foreign residue

- **WHEN** 发送参数携带 model 且会话绑定 managed provider
- **THEN** 传给 Claude CLI 的 `--model` MUST 为当前 profile catalog/env 解析后的 runtime
- **AND** MUST NOT 使用其它供应商残留模型名（例如 DeepSeek profile 下的 `k3`）
