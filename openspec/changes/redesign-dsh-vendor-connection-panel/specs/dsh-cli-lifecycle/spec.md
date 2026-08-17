## MODIFIED Requirements

### Requirement: DSH CLI can be installed and diagnosed

`CliInstallEngine` SHALL include `Dsh` with npm package `@deepseek-ai/dsh@latest`
and binary name `dsh`. Doctor SHALL check Node version, `dsh --version`, and
optional `host.describe`.

CLI配置管理的 DSH 页 SHALL 消费同一份 doctor 结果区分「未安装」与「host 未运行」。设置页探测 SHALL NOT spawn `dsh web`。用户在该页点击「立即启动」时 MAY spawn。用户点击「关闭」且 Host 为本机时 MAY 停止该 origin 上的 listener。Windows 探测 SHALL 扫描 Hermes / Scoop / mise / fnm 的常规 bin 位置，不得只信 GUI 进程 PATH。

#### Scenario: CLI missing

- **WHEN** no `dsh` binary is on PATH or `dshBin`
- **THEN** engine status SHALL be not-installed
- **AND** the installer SHALL offer the npm global package
- **AND** other engines SHALL keep working

#### Scenario: CLI present but host down

- **WHEN** `dsh --version` succeeds and `host.describe` fails
- **THEN** status SHALL NOT report the CLI as missing
- **AND** auto-start MAY spawn `dsh web` on the send / session path
- **AND** the settings probe SHALL leave the host down until the user starts it or a send-path ensure runs
- **AND** an empty model list SHALL be explained as host/catalog, not missing binary

#### Scenario: Node too old

- **WHEN** `node --version` is outside `^22.19.0 || >=24.0.0`
- **THEN** doctor SHALL emit a readable Node version error
- **AND** SHALL NOT treat that as a generic unknown spawn failure

#### Scenario: Windows Hermes or Scoop install

- **WHEN** `dsh` 装在 `%USERPROFILE%\.hermes\node\bin`、Scoop shims 或等价前缀，且 GUI PATH 没有该目录
- **THEN** doctor / `find_cli_binary("dsh")` SHALL 仍能解析到该二进制
- **AND** SHALL NOT 仅因 GUI PATH 缺失而报未安装
