# Verification

## 完整性

- 5/5 tasks complete。
- Delta requirement 已同步到 `openspec/specs/semantic-code-navigation-provider/spec.md`。
- 未新增 dependency、frontend contract 或 provider-specific hardcode。

## 正确性

- `src-tauri/src/backend/app_server_cli.rs:98`：selected npm launcher 解析完成后才构造 probe PATH。
- `src-tauri/src/backend/app_server_cli.rs:129`：canonical npm parent 优先，canonicalization failure 保留 seed paths。
- `src-tauri/src/backend/app_server_cli.rs:2698`：Unix regression test 模拟 symlinked npm 与 competing Node，断言返回 matching runtime prefix。
- 真实机器验证：Hermes prefix 为 `/Users/chenxiangning/.hermes/node`，`pyright-langserver` 解析到 `/Users/chenxiangning/.hermes/node/bin/pyright-langserver`。
- Windows wrapper executor 与 prefix layout 未改；共享 resolver module 29 tests 全通过。

## 一致性

- 实现遵循 design：vendor-neutral canonicalization、bounded probe-only PATH、best-effort fallback。
- 修复位于共享 `find_cli_binary` dependency path，Pyright、TypeScript language server 与 npm-installed CLI 共用，无 provider 分叉。

## Automated Evidence

- `cargo test --manifest-path src-tauri/Cargo.toml backend::app_server_cli::tests`：29 passed（lib）+ 29 passed（daemon mirror）。
- `cargo test --manifest-path src-tauri/Cargo.toml code_intel_lsp::tests`：17 passed。
- `cargo test --manifest-path src-tauri/Cargo.toml code_intel::tests`：3 passed。
- `npm run lint`：passed。
- `npm run typecheck`：passed。
- `npm run check:runtime-contracts`：passed。
- `openspec validate fix-symlinked-npm-cli-discovery --strict --no-interactive`：passed。
- `openspec validate --specs --strict --no-interactive`：420/420 passed。
- `git diff --check`：passed。
- `npm run check:large-files`：command exit 0，报告 57 个 existing baseline entries；本次触及的 `app_server_cli.rs` 已在现有报告中，未扩展范围拆分。

## Known Unrelated Baseline

- `openspec validate --all --strict --no-interactive`：441/442；仅 existing active change `fix-claude-cli-native-installer` 因两个 MODIFIED requirements 缺少 requirement text 失败，与本变更无关。
- Rust build 仍显示 Codex/Kimi 等 existing warnings；本次新增的 temporary `cwd` warning 已清理。
