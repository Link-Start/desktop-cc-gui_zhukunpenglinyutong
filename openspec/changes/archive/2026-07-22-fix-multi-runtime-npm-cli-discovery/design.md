## Context

Desktop process PATH 可同时包含 Homebrew、nvm、Hermes 等多个 Node/npm runtime。`which npm` 只返回第一个；而 npm launcher 往往经历 `user shim -> runtime/bin/npm -> lib/node_modules/npm/bin/npm-cli.js` 多跳 symlink。最终 canonical parent 不是 Node runtime bin，也不代表其他 npm installation。

## Goals / Non-Goals

**Goals:**

- 从既有 supported search paths 发现多个 npm launchers。
- bounded follow symlink hops，保留每一跳 parent directory。
- 环境 prefix、launcher directories 与 primary npm reported prefix additive merge。
- 不增加 process spawn 数量。

**Non-Goals:**

- 不递归扫描 filesystem。
- 不执行所有 npm launcher。
- 不改变 provider selection 或 LSP lifecycle。

## Decisions

### 1. Search path enumeration instead of first-npm identity

遍历既有 bounded `seed_paths`，检查 platform npm filenames；每个 launcher 只沿 symlink chain 最多 8 跳。这样可发现 second runtime，同时避免 home directory scan。

替代方案执行所有 npm `config get prefix`，会放大 startup/probe latency 和 hang surface，拒绝。

### 2. Preserve every symlink-hop parent

launcher parent、intermediate target parent 与 final target parent 都作为 candidate。runtime bin 通常位于中间 hop，最终 `npm-cli.js` parent 仅是 package internals。

替代方案只使用 canonical target，已被真实 Hermes topology 证伪。

### 3. Environment prefix becomes additive

`NPM_CONFIG_PREFIX` 只增加一个 candidate，不再 early return。primary npm reported prefix 继续保留，用于 custom prefix compatibility。

### 4. Platform launcher names remain explicit and bounded

Unix 检查 `npm`；Windows 检查 `npm.cmd`、`npm.exe`、`npm.bat`、`npm.ps1` 与 `npm`。不执行 shell parsing。

## Risks / Trade-offs

- [Risk] extra filesystem metadata checks → 仅扫描已有 bounded search paths 与最多 8 个 symlink hops，无递归。
- [Risk] broken/cyclic symlink → read failure stops current chain；hop cap 保证 bounded。
- [Risk] multiple same-name providers → 维持原 search path precedence，deterministic first match。

## Migration Plan

无数据迁移。explicit retry 重新计算 candidates。回滚时 provider-specific environment override 仍可用。

## Open Questions

无。
