# Change: Fix Claude CLI Native Installer

## Why

Claude Code 官方安装已从 npm global 切换为 native installer（`curl -fsSL https://claude.ai/install.sh | bash` / Windows `irm ... | iex`），升级为 `claude update`。现有 one-click installer 仍对 Claude 走 `npm install -g @anthropic-ai/claude-code@latest`，导致安装持续失败。

## What Changes

- Claude `installLatest` → `officialNative`（官方 install script）
- Claude `updateLatest` → `cliSelfUpdate`（`claude update`）
- Claude `uninstall` → 删除官方 native 路径（`~/.local/bin/claude` + `~/.local/share/claude`）
- Codex / Kimi 继续 npm global
- Claude install preflight 不再把 Node/npm 缺失当作 blocker
- 更新 `cli-one-click-installer` spec 与 command preview / tests

## Impact

- Affected specs: `cli-one-click-installer`
- Affected code: `src-tauri/src/codex/installer.rs`, frontend strategy helpers / types
