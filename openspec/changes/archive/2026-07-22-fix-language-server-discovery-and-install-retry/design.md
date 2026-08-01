## Context

`code_intel_lsp` 当前把 default provider name 直接交给 `Command::new`。Terminal 安装成功不代表 Finder/LaunchServices 启动的 desktop app 拥有相同 `PATH`。仓库已有 `find_cli_binary` 与 extended search path，覆盖 Homebrew、npm/NVM、Cargo、Windows wrappers，但 semantic provider 尚未复用。

## Goals / Non-Goals

**Goals:**

- override 优先，随后使用 existing extended CLI resolver，最后才保留 bare executable fallback。
- provider child process 继承 extended CLI `PATH`，保证 `jdtls`、Node wrapper 与 Rust toolchain dependency 可达。
- unavailable fallback 同屏显示安装命令与重新检测，安装后无需重启 app。
- 不增加编辑器常驻成本。

**Non-Goals:**

- 不执行安装、不探测 package manager、不持久化 provider status。
- 不改变 session cache、LSP protocol 或 fallback scanner。

## Decisions

### 1. Reuse the existing extended CLI resolver

将现有 generic search-path 结果暴露为 `build_cli_path_env`，`build_codex_path_env` 保持兼容 delegation。`code_intel_lsp` 使用 `find_cli_binary` 解析 absolute executable，并给 child 设置同一 PATH。

Alternative：在 code-intel 内复制 `/opt/homebrew`、NVM、Cargo、Windows candidate matrix。拒绝，重复且会随两个 resolver 漂移。

### 2. Override remains authoritative

`MOSSX_*_LANGUAGE_SERVER_BIN` 非空时不再二次选择其他 executable，但 child PATH 仍补齐 dependency lookup。保持高级用户显式配置语义。

### 3. Retry is explicit and local

Fallback note 复用现有 `onRetryNavigation`，不新增 backend command、timer 或 provider status store。每次 retry 都重新执行 executable resolution；安装后立即可生效。

### 4. Installation command remains visible

`provider-unavailable` 时 command 是 fallback note 的固定内容，不依赖 clipboard capability。Clipboard 不可用只隐藏 copy button；重新检测保持可用。

## Risks / Trade-offs

- [Risk] 用户安装后 wrapper dependency 仍不可达 → child 显式使用 extended PATH。
- [Risk] multiple installations resolve a different provider → explicit override 永远优先，并保持 deterministic path order。
- [Risk] retry during installation still fails → bounded fallback 重现，不轮询、不阻塞编辑器。
- [Trade-off] resolver 每次 explicit retry 扫描少量 known directories → 换取无需重启和无 stale negative cache；不进入 typing/hover path。

## Migration Plan

Additive backend/UI fix，无数据迁移。回滚 `build_cli_path_env` exposure、provider resolution 和 fallback retry block 即恢复旧行为。

## Open Questions

无。
