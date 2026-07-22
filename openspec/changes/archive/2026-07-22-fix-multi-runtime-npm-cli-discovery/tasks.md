## 1. Multi-runtime discovery

- [x] 1.1 [P0, depends: none] 输入 npm launcher path；输出 bounded symlink-hop parent directories；以 nested symlink test 验证。
- [x] 1.2 [P0, depends: 1.1] 输入 supported seed paths；输出所有 npm launcher-derived bin candidates；以 primary/secondary runtime test 验证。
- [x] 1.3 [P0, depends: 1.2] 将 env prefix、launcher candidates 与 primary npm prefix additive merge 到 shared CLI PATH；验证 explicit override 与 deterministic precedence 不变。

## 2. Cross-platform and live verification

- [x] 2.1 [P1, depends: 1.3] 覆盖 Unix npm 与 Windows `.cmd/.bat/.exe/.ps1` launcher names，运行 shared resolver tests。
- [x] 2.2 [P1, depends: 1.3] 对当前 installed `pyright-langserver` 执行 stdio initialize smoke，并验证 backend discovery path。
- [x] 2.3 [P1, depends: 2.1, 2.2] 运行 LSP、lint、typecheck、runtime contracts 与 strict OpenSpec gates，记录 verification。
- [x] 2.4 [P1, depends: 2.3] 同步 main spec 并归档 OpenSpec/Trellis；不执行 Git commit。
