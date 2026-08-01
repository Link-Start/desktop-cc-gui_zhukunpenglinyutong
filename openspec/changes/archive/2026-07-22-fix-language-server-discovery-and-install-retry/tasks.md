## 1. Provider Discovery（P0）

- [x] 1.1 [依赖: 无] 暴露 existing extended CLI PATH builder，保持 Codex caller compatibility；focused Rust tests 验证 custom/system/user path composition。
- [x] 1.2 [依赖: 1.1] semantic provider 按 override → extended resolver → bare name 解析 executable，并向 child 注入 extended PATH；focused Rust tests 覆盖 override、resolved path 与 Windows wrapper contract。

## 2. Installation Recovery UI（P0）

- [x] 2.1 [依赖: 无] `provider-unavailable` fallback 同屏显示 current OS、安装命令、copy action 与安装后重新检测；其他 reason 不显示安装命令。
- [x] 2.2 [依赖: 2.1] 同步全部 locales 与 compact styles；focused component tests 覆盖 macOS Java command、clipboard unavailable 与 retry。

## 3. Verification And Closure（P0）

- [x] 3.1 [依赖: 1.2, 2.2] 运行 focused Vitest、focused Cargo tests、typecheck、targeted lint、实际 `jdtls` discovery probe、`git diff --check` 与 strict change validation；不运行全量测试。
- [x] 3.2 [依赖: 3.1] 执行 OpenSpec verify、sync main specs 并 archive change。
