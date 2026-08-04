# managed-command-runtime-safety Specification

## Purpose

TBD - created by archiving change. Update Purpose for `managed-command-runtime-safety`.

## Requirements

### Requirement: Managed command creation MUST reject duplicates atomically

系统 MUST 在 filesystem create operation 上原子拒绝同名 managed command，MUST NOT 通过可竞态的 preflight existence check 保证 duplicate safety。

#### Scenario: Concurrent creates use the same command name

- **WHEN** 两个并发 create 请求写入相同 `<name>.md`
- **THEN** 恰好一个请求 MUST 成功
- **AND** 另一个请求 MUST 返回 duplicate error
- **AND** 成功请求的内容 MUST NOT 被覆盖

#### Scenario: New command write fails after exclusive create

- **WHEN** exclusive create 成功但内容写入失败
- **THEN** 系统 MUST 返回可追踪错误
- **AND** 系统 MUST best-effort 删除本次创建的 partial file

### Requirement: Commands watcher lifecycle MUST serialize start and stop per scope

同一 workspace scope 的 watcher start/stop MUST 确定性排序；effect cleanup MUST NOT 在 start 注册完成前丢失 stop。

#### Scenario: Hook unmounts while watcher start is pending

- **WHEN** commands hook 在 `start` promise settle 前卸载
- **THEN** cleanup MUST 在 start settle 后执行 matching stop
- **AND** registry MUST NOT 遗留该 scope 的失管 watcher

#### Scenario: Concurrent starts target the same scope

- **WHEN** 同一 scope 的两个 start command 并发执行
- **THEN** registry check 与 handle insert MUST 被同一 lifecycle critical section 保护
- **AND** registry MUST 最多保留一个 active handle 与两份 lease
- **AND** 第一份 matching stop MUST 只释放一份 lease，不得 abort 第二个 caller 仍使用的 watcher
