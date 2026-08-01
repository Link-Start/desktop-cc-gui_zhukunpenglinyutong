## 1. Backend Provider Configuration

- [x] 1.1 [P0, 依赖: 无] 输入现有 `SemanticProvider` descriptor，新增 Pyright/gopls id、language id、environment override、executable、args 与 lifecycle；输出 generic runtime 可启动两个 provider；运行 provider mapping/launch focused Rust tests。
- [x] 1.2 [P0, 依赖: 1.1] 输入现有 `LanguageKind` routing，升级 Python/Go definition、references、implementation 为 semantic-first；输出保持原 response shape 与 authoritative empty/fallback contract；运行 `code_intel` focused Rust tests。
- [x] 1.3 [P0, 依赖: 1.2] 输入 timeout/fatal/provider-unavailable cases，验证 Pyright/gopls cancellation、session reuse、isolated eviction 与 public reason code；输出无 cold-start loop 的回归覆盖；运行 `code_intel_lsp::tests`。

## 2. Frontend Compatibility And Guidance

- [x] 2.1 [P1, 依赖: 1.1] 输入 Python/Go file extensions，扩展 existing 750ms idle prewarm allowlist；输出一次性 `code_intel_prepare` 且无 typing/hover query；运行 `FileViewPanel` focused Vitest。
- [x] 2.2 [P1, 依赖: 1.2] 输入 `provider-unavailable + language` metadata，增加 Pyright/gopls install hints；输出只读、可复制、不可自动执行的 platform-safe command；运行 navigation utility/panel focused Vitest。
- [x] 2.3 [P1, 依赖: 2.2] 输入现有 locale dictionary，补齐 Python/Go provider missing copy并保持所有 locale key 对齐；输出无 hardcoded UI copy；运行 typecheck 与 targeted lint。

## 3. Verification And Closure

- [x] 3.1 [P0, 依赖: 1.3, 2.3] 运行 focused Rust tests、focused Vitest、typecheck、lint、runtime contracts 与 large-file gate；输出全部自动化门禁证据并修复回归。
- [x] 3.2 [P0, 依赖: 3.1] 执行 `openspec-verify-change` 并记录 implementation/spec/tasks 对齐证据；输出 verification artifact 与 strict validation success。
- [x] 3.3 [P0, 依赖: 3.2] 同步 delta spec、归档 change 并刷新 OpenSpec indexes；输出 main spec current truth 与 archived closure，不执行 git commit。
