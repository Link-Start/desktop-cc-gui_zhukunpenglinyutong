## 1. Semantic Runtime

- [x] 1.1 [P0, depends: none] 新增 LSP frame encode/decode 与 response normalization；输入 JSON-RPC bytes/Value，输出 correlated response/locations；focused Rust tests 覆盖 partial frame、Location/LocationLink、malformed response。
- [x] 1.2 [P0, depends: 1.1] 实现 workspace-scoped `rust-analyzer` session lifecycle；输入 workspace/document/query，输出 bounded semantic result；focused actual-server/EOF tests 验证 initialize、definition、implementation、reuse 与 pending cleanup。
- [x] 1.3 [P0, depends: 1.2] 将 runtime 注入 `AppState`，使用现有 cross-platform process helper并校验 file URI workspace containment；focused backend URI tests 与既有 frontend Windows navigation test 覆盖 path identity 和 external URI rejection。

## 2. Backend Navigation

- [x] 2.1 [P0, depends: none] 扩展 `LanguageKind::Rust`、Rust declaration/reference scanner 与 deterministic ranking；focused Rust tests 验证 struct/trait/fn/impl，并复用既有 ignored path、file-size 和 result cap boundary。
- [x] 2.2 [P0, depends: 1.3,2.1] definition/references 对 Rust 接入 semantic-first/fallback，并保持旧 `result` payload compatibility；focused runtime/scanner tests 验证 semantic result 与 fallback prerequisites。
- [x] 2.3 [P0, depends: 1.3,2.1] 新增 `code_intel_implementations` command；Rust semantic-first，Java/TS/JS/Rust conservative fallback；focused tests 验证 implements/extends/impl 与 multi-target collection，command 显式拒绝 unsupported language。

## 3. Frontend Navigation

- [x] 3.1 [P0, depends: 2.3] 增加 Tauri implementations service mapping 与 contract test；输入 workspace/file/position/current text，输出兼容 LSP location result。
- [x] 3.2 [P0, depends: 3.1] 扩展 `useFileNavigation` implementation cache/state/action，复用 timeout、stale request guard 与 navigate behavior；focused component tests 验证 single target，既有共享 navigation tests 覆盖 multi/empty/error behavior。
- [x] 3.3 [P0, depends: 3.2] 增加 FileView context action、共享 candidate panel 与全部 locale labels；focused FileView tests 验证 action 可达且不因 cursor movement 自动请求。

## 4. Verification And Closure

- [x] 4.1 [P0, depends: 1.1-3.3] 运行 touched Rust tests、touched Vitest、incremental ESLint、TypeScript typecheck 与 AppShell/code navigation contract；禁止全量 test suite。
- [x] 4.2 [P0, depends: 4.1] 执行 `openspec validate upgrade-semantic-code-navigation --strict --no-interactive`、change verification、spec sync 与 archive；记录真实命令和已知 fallback 限制。
