## 1. Shared CLI discovery fix

- [x] 1.1 [P0, depends: none] 输入 selected npm launcher 与 existing seed paths；输出 canonical runtime parent 优先的 bounded npm probe `PATH`；验证 canonicalization failure 保留 fallback。
- [x] 1.2 [P0, depends: 1.1] 输入 symlinked npm launcher、competing Node runtime 与 fake global prefix；输出正确 npm global bin；通过 Unix regression test 验证。

## 2. Cross-platform compatibility and closure

- [x] 2.1 [P1, depends: 1.1] 核对 Windows `.cmd`/`.bat` wrapper 与 prefix layout 不变；运行相关 Rust tests。
- [x] 2.2 [P1, depends: 1.2, 2.1] 运行 app_server_cli、code_intel_lsp、lint、typecheck 与 strict OpenSpec validation，并记录 evidence。
- [x] 2.3 [P1, depends: 2.2] 同步 main spec、归档 OpenSpec change 与 Trellis task；不执行 Git commit。
