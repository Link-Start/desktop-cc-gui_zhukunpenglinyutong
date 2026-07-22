## 1. Hint Model（P0）

- [x] 1.1 [依赖: 无] 输入 normalized language 与 `macos/windows/linux`，输出 bounded command hint；focused utility tests 覆盖 3×Java/TS-JS/Rust matrix 与 unsupported language。

## 2. Fallback UI（P0）

- [x] 2.1 [依赖: 1.1] 仅对 `provider-unavailable` render command、platform label 与 copy action；focused component tests 覆盖 visible/hidden/copy/clipboard-unavailable。
- [x] 2.2 [依赖: 2.1] 同步全部 locale keys 与 compact theme-token styles；targeted lint/typecheck 验证。

## 3. Verification And Closure（P0）

- [x] 3.1 [依赖: 2.2] 运行 focused Vitest、typecheck、targeted lint、`git diff --check` 与 strict single-change validation；不运行全量测试。
- [x] 3.2 [依赖: 3.1] 执行 OpenSpec verify、sync main spec 并 archive change。
