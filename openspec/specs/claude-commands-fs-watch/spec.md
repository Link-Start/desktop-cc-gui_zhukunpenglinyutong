# claude-commands-fs-watch Specification

## Purpose

TBD - created by archiving change. Update Purpose for `claude-commands-fs-watch`.

## Requirements

### Requirement: Claude commands list MUST refresh on filesystem change

系统 MUST 监听命令目录集合的文件变更并驱动前端刷新，MUST NOT 使用秒级轮询。

#### Scenario: new command file appears in completion

- **WHEN** 用户在 `<workspace>/.claude/commands/`（或 `.codex/commands`、`.agents/commands`、workspace managed、global 目录）新增/修改/删除 `.md` 命令文件
- **THEN** Rust watcher MUST 在去抖后 emit `claude-commands-changed`
- **AND** 前端 MUST 重新拉取使命令补全在秒级内反映变更

#### Scenario: watcher lifecycle follows active workspace

- **WHEN** 活动 workspace 切换或 commands hook 卸载
- **THEN** 系统 MUST stop 旧 watcher 并按新作用域 start
- **AND** 对同一作用域重复 start MUST 幂等

#### Scenario: slow fallback poll remains as safety net

- **WHEN** watcher 遗漏变更（如 watcher 通道异常）
- **THEN** 前端 MUST 以不低于 30s 周期的 visibility-gated 轮询兜底收敛
