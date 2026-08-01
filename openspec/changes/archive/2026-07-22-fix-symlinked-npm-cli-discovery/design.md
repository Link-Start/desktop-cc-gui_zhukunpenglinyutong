## Context

`find_cli_binary()` 复用 `discover_npm_global_bin_dir_from_npm()` 获取 npm global prefix。当前 probe 找到 `~/.local/bin/npm` 后直接继承 GUI extended `PATH`；当该 launcher 是指向另一 Node distribution 的 symlink 时，`#!/usr/bin/env node` 可能先解析到 Homebrew/System Node，使 npm 按错误 runtime 返回 prefix。

## Goals / Non-Goals

**Goals:**

- npm probe 与已选择的 npm launcher 绑定同一 runtime directory。
- Unix symlink、普通 executable 与 Windows wrapper 都维持 best-effort、cross-platform behavior。
- 仅修复共享 discovery，一次覆盖 Pyright 与其他 npm-installed CLI。

**Non-Goals:**

- 不启动 login shell，不解析 shell rc 文件。
- 不枚举具体 Node version manager。
- 不改变 provider launch args 或 IPC contract。

## Decisions

### 1. Canonical npm parent 优先于 seed paths

对选中的 npm path 执行 best-effort `canonicalize()`，取真实 executable parent，并在 npm prefix probe 的 `PATH` 首位插入。随后追加原有 seed paths 并去重。

替代方案是扫描 Hermes/nvm/Volta 目录。该方案与 vendor layout 耦合，且无法覆盖自定义 symlink，因此不采用。

### 2. Canonicalization failure 保持 fallback

路径不存在、权限不足或 Windows wrapper 无法 canonicalize 时，不返回错误；继续用既有 seed paths 执行 probe。CLI discovery 本身是 best-effort，不能因增强逻辑扩大 failure surface。

### 3. Windows 保留现有 wrapper executor

npm probe 仍通过 `build_std_command_for_binary()` 处理 `.cmd`、`.bat` 与 `.ps1`。真实 parent 的 PATH enrichment 不替换 wrapper launch，仅补充 runtime dependency resolution。

## Risks / Trade-offs

- [Risk] npm launcher 的真实目录不含匹配 Node runtime → 仍回退到既有 PATH resolution；不会比当前更差。
- [Risk] canonical target parent 改变 Node 优先级 → 仅作用于 bounded `npm config get prefix` probe，不污染 app process 或 provider runtime。
- [Risk] Windows symlink semantics 不同 → 保留 wrapper executor 与现有 global prefix mapping，并由既有 Windows tests 守卫。

## Migration Plan

无需数据迁移。发布后 explicit retry 会重新执行 discovery。回滚只需恢复 npm probe PATH 构造，用户仍可使用 provider-specific environment override。

## Open Questions

无。
