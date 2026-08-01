## Why

用户通过 symlinked npm launcher（例如 `~/.local/bin/npm -> ~/.hermes/node/bin/npm`）全局安装 language server 后，desktop GUI 可能用另一套先命中的 `node` 执行 npm，导致 `npm config get prefix` 返回错误 prefix。结果是已安装的 `pyright-langserver` 仍被判定 unavailable。

## 目标与边界

- 修复共享 CLI discovery，使 npm launcher 与其真实 runtime bin directory 保持一致。
- 覆盖 macOS/Linux symlink launcher 与 Windows `.cmd` / `.bat` wrapper 的既有启动方式。
- 保持 explicit binary override、platform candidate paths、provider launch contract 不变。

## 非目标

- 不自动安装、升级或内置 Pyright、gopls 或 Node.js。
- 不引入 Hermes、nvm、Homebrew 等 vendor-specific hardcode。
- 不改变 frontend warning、安装命令或 LSP response contract。

## What Changes

- npm prefix probe 在执行 npm 前解析 launcher 的真实位置，并优先注入其 parent directory 到 probe `PATH`。
- 若 canonicalization 失败，则保留当前 cross-platform fallback，不阻断其他 CLI discovery。
- 增加 symlinked npm launcher 与 competing Node runtime 的 Unix regression test，并保留 Windows wrapper behavior。

## 方案对比与取舍

- 方案 A：为 Hermes、nvm、Volta 分别增加目录扫描。覆盖不完整、维护成本高，拒绝。
- 方案 B：从实际 npm launcher 反推真实 runtime directory，并仅在 npm prefix probe 中提高其优先级。vendor-neutral、改动集中，采用。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `semantic-code-navigation-provider`: desktop GUI 必须正确发现由 symlinked npm runtime 安装的 external language server。

## 验收标准

- symlinked npm launcher 即使面对另一个更早的 Node runtime，也能返回自身 global prefix。
- `find_cli_binary("pyright-langserver", None)` 可通过扩展搜索路径解析对应 executable。
- Windows npm global prefix 与 `.cmd` / `.bat` provider wrapper contract 不回退。
- Rust 定向测试、semantic navigation 测试与 strict OpenSpec validation 通过。

## Impact

- Backend：`src-tauri/src/backend/app_server_cli.rs` 的共享 npm global bin discovery。
- Semantic providers：Pyright、TypeScript language server，以及其他复用 `find_cli_binary` 的 external CLI。
- Dependencies：无新增 dependency；失败路径继续 best-effort fallback。
