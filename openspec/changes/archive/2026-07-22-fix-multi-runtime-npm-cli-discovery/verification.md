# Verification

## 完整性

- 7/7 tasks complete。
- `semantic-code-navigation-provider` main spec 已同步 multi-runtime 与 nested symlink scenarios。
- 无新增 dependency、IPC 或 frontend behavior。

## 正确性

- npm launcher enumeration 仅遍历既有 bounded seed paths。
- symlink traversal 最大 8 hops，保留 launcher/intermediate/final parent directories。
- upper/lower-case npm prefix env 都作为 additive candidate，不再 early return。
- multi-runtime test 证明 primary npm 在前时仍能发现 secondary runtime 的 `pyright-langserver`。
- installed-provider Rust test 在当前机器成功解析 Hermes Pyright。
- real `pyright-langserver --stdio` initialize smoke 收到 capabilities。

## 一致性

- 共享 `find_cli_binary` path 修复，未添加 Pyright/Hermes vendor special case。
- Windows launcher names 覆盖 `.cmd/.exe/.bat/.ps1`，既有 wrapper executor 未修改。
- broken symlink 与 metadata failure 保持 best-effort fallback。

## Automated Evidence

- `cargo test ... backend::app_server_cli::tests`：31 passed（lib）+ 31 passed（daemon mirror）。
- `cargo test ... code_intel_lsp::tests`：18 passed。
- `cargo test ... code_intel::tests`：3 passed。
- installed Pyright discovery test：passed。
- real Pyright initialize smoke：passed。
- `npm run lint`：passed。
- `npm run typecheck`：passed。
- `npm run check:runtime-contracts`：passed。
- change strict validation：passed。
- main specs strict validation：420/420 passed。
- `git diff --check`：passed。

## Known Unrelated Baseline

- Rust build 保留 Codex/Kimi existing warnings，与本变更无关。
- global OpenSpec validation 的 existing `fix-claude-cli-native-installer` malformed delta 仍为独立基线问题。
