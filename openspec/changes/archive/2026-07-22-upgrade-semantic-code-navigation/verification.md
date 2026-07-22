## Scope

- Rust semantic definition、references、implementation provider 与 workspace lifecycle。
- Rust/Java/TS implementation fallback。
- FileView implementation action、current document sync、候选复用与全部 locale labels。

## Checks Run

- `cargo test code_intel::tests`：2 passed。
- `cargo test code_intel_lsp::tests`：6 passed；本机真实 `rust-analyzer` integration 覆盖 definition、implementation、session reuse。
- `cargo test app_settings_round_trips_all_frontend_shortcut_fields`：lib/daemon 各 1 passed。
- 定向 Vitest 14 files：301 passed，覆盖 search、settings、CodeMirror、Tauri mapping、FileView navigation。
- changed TypeScript/TSX incremental ESLint：passed。
- `npm run typecheck`：passed。
- `npm run check:app-shell:runtime-contract`：passed。
- `openspec validate upgrade-semantic-code-navigation --strict --no-interactive`：passed。
- 未运行全量 test suite，符合用户明确约束。

## Results

- `rust-analyzer` 可用时正常空 result 保持权威，不混入同名 heuristic candidates。
- server 缺失、启动/请求失败或 EOF 时 session 被淘汰，Rust 进入 bounded fallback。
- semantic locations 仅接受 canonical workspace 内的 local file URI；external/non-file URI 被丢弃。
- implementation command/UI 为 additive change；existing definition/references `result` contract 保持兼容。

## Risks / Follow-ups

- Java、Python、TS/JS、Go 的 definition/references 仍主要使用 heuristic scanner；本 change 只为 Rust 接入真实 semantic provider。
- `rust-analyzer` 不随应用捆绑；未安装时使用保守 fallback，无法提供完整 scope/type precision。
- Rust compiler run 输出仓库既有 warnings（Codex installer/Kimi/menu dead code），本 change 未新增对应 warning，未扩大范围修复。
