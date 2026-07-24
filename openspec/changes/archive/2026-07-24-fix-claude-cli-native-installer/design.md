## Context

Claude Code 官方安装渠道已改为 native installer；本仓库 one-click installer 仍对 Claude 使用 npm global，导致安装失败。

## Goals / Non-Goals

- Goals: Claude install/update/uninstall 对齐官方文档；Codex/Kimi 保持 npm；白名单 argv 不变（无 frontend raw shell）。
- Non-Goals: 不自动处理 Homebrew / WinGet / apt 安装渠道的卸载；不改写 shell profile / PATH；不把 registry probe 改为非 npm 来源。

## Decisions

1. Backend `resolve_effective_strategy`：即使 frontend 仍传 `npmGlobal`，Claude 也会被改写为 `officialNative` / `cliSelfUpdate`。
2. Claude install 使用固定官方脚本 URL（`https://claude.ai/install.sh` / `install.ps1`），经 `/bin/bash -lc` 或 `powershell -Command` 执行。
3. Claude update 使用 `claude update`。
4. Claude uninstall 仅删除官方 native 路径；plan warning 提示其他渠道需手动卸载。
5. `node_ok` 对 Claude 表示平台可安装，不再要求 Node/npm；latest version 仍可选地用 `npm view @anthropic-ai/claude-code`。

## Risks

- Homebrew 安装的 `claude` 可能被 `claude update` / native uninstall 误处理：uninstall warning 已说明范围；update 依赖本机 `claude` binary 自身行为。
- `curl | bash` 仍是官方推荐路径；本仓库只放行固定 URL。
