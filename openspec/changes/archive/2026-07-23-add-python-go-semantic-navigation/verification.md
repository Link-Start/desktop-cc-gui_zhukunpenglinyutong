# Verification: add-python-go-semantic-navigation

## 摘要

| 维度 | 状态 |
|---|---|
| 完整性 | 8/9 tasks（archive task 待执行），4 requirements / 12 scenarios 均有实现证据 |
| 正确性 | provider mapping、routing、prewarm、install guidance、timeout/fatal lifecycle 与 fallback contract 已覆盖 |
| 一致性 | 遵循 generic descriptor、external executable、unchanged IPC、no dependency/no polling design |

## Requirement Mapping

- Python/Pyright：`src-tauri/src/code_intel_lsp.rs` provider descriptor + `src-tauri/src/code_intel.rs` semantic routing；descriptor/mapping tests通过。
- Go/gopls：复用同一 descriptor/runtime/routing；无 provider-specific runtime copy。
- Lifecycle：existing request cancel、fatal-only eviction、session cap、idle eviction contract unchanged；`code_intel_lsp::tests` 17/17 passed。
- Prewarm：`.py/.pyi/.go` 进入 existing 750ms idle prepare path；`FileViewPanel.test.tsx` 覆盖三种 extension。
- Installation guidance：shared helper 输出 `npm install -g pyright` 与 `go install golang.org/x/tools/gopls@latest`；utility/panel tests 覆盖三平台 command mapping 与 recovery surface。
- Distribution：未修改 package manifests、bundle config 或 installer；provider 仅由 PATH/environment override discovery。

## Automated Evidence

- `cargo test --manifest-path src-tauri/Cargo.toml code_intel_lsp::tests`：17 passed。
- `cargo test --manifest-path src-tauri/Cargo.toml code_intel::tests`：3 passed。
- focused Vitest：3 files、102 tests passed。
- `npm run lint`：passed。
- `npm run typecheck`：passed。
- `npm run check:runtime-contracts`：passed。
- `openspec validate add-python-go-semantic-navigation --strict --no-interactive`：passed。
- `openspec validate --specs --strict --no-interactive`：420/420 passed。
- `git diff --check`：passed。

## Known Environment / Repository Gates

- 当前开发机未发现 `pyright-langserver` 或 `gopls`，因此未执行 live-provider smoke；external provider absence 是本 change 的正式 fallback 场景，不影响 automated contract verification。
- `npm run check:large-files` 已执行但因全仓 57 个现有 baseline debt 返回失败。`src-tauri/src/code_intel_lsp.rs` 在本 change 前的 HEAD 已为 1492 行，且未出现在 large-file baseline；本 change 不扩大为全仓 baseline 治理或高风险文件拆分。
- archive 后 `openspec validate --all --strict --no-interactive` 为 439/440；唯一失败来自既有 active `fix-claude-cli-native-installer` 的两个 incomplete MODIFIED requirement blocks，本 change 的 main specs 全部通过。
- Rust build 输出现有 Codex/Kimi unused/private-interface warnings；本 change 未新增对应 warning。

## Assessment

无 CRITICAL implementation/spec/design mismatch。已知 large-file baseline debt 与 live-provider availability 均已显式记录；change 可同步并归档。
