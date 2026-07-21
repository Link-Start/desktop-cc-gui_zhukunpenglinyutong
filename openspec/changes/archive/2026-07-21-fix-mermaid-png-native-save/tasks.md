## 1. Native persistence contract

- [x] 1.1 [P0, no dependency] 新增 `save_mermaid_png(path, pngBytes)` Tauri command；输入为用户选择路径与 PNG bytes，输出为 `Result<(), String>`；用 Rust tests 验证 valid/invalid/oversized payload。
- [x] 1.2 [P0, depends on 1.1] 将 command 注册到 `command_registry`；用 compile/runtime contract gate 验证 frontend 可调用。

## 2. Frontend export flow

- [x] 2.1 [P0, depends on 1.2] 在 Tauri runtime 使用 native Save Dialog + IPC 保存 encoded PNG；输出为实际文件或 cancellation；用 Vitest 覆盖 success/cancel/error。
- [x] 2.2 [P1, depends on 2.1] 保留非 Tauri anchor fallback 与 Object URL cleanup；用现有 Vitest regression 验证。

## 3. Verification and closure

- [x] 3.1 [P0, depends on 1-2] 运行 focused frontend/Rust tests、lint、typecheck、runtime contract、diff check 与 strict OpenSpec validation。
- [x] 3.2 [P1, depends on 3.1] 在 Tauri dev runtime 打开 Save Dialog、保存 PNG 并验证文件可打开；记录 exact evidence。
- [x] 3.3 [P1, depends on 3.2] 同步 main spec、生成 verification artifact 并归档 change。
