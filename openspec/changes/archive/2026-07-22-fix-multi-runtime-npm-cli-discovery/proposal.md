## Why

第一次修复只把 selected npm launcher 与其 canonical target 绑定，但真实 npm symlink 最终指向 `npm-cli.js`，并不等于 Node runtime bin；同时 desktop process 可能优先选择 Homebrew npm，而 provider 安装在 Hermes/nvm 等第二套 runtime。单 npm 假设仍会漏检已安装的 language server。

## 目标与边界

- 将 CLI discovery 从“单 npm prefix”改为“多个 npm launcher/runtime bin candidates”。
- 沿 symlink hop 收集 launcher directory，而不是只取最终 canonical parent。
- 保持 macOS、Linux、Windows wrapper 与 explicit provider override 兼容。
- 用真实 installed Pyright 完成 stdio initialize smoke。

## 非目标

- 不扫描整个 home directory。
- 不硬编码 Hermes、nvm、Homebrew、Volta、mise 产品名或版本目录。
- 不自动安装 language server，不修改 frontend fallback contract。

## What Changes

- bounded 遍历 supported search paths 中所有 npm launchers，并收集各 symlink hop 的 parent directory。
- `NPM_CONFIG_PREFIX` 作为 additive candidate，不再阻断其他 runtime candidates。
- 修正 npm prefix probe 的 runtime PATH 构造。
- 增加 multi-runtime、nested symlink、Windows launcher name 与 fallback tests。

## 方案对比与取舍

- 方案 A：继续执行第一个 npm 的 `config get prefix`。无法覆盖多 runtime，拒绝。
- 方案 B：枚举 vendor-specific installation roots。维护成本高且必然漏项，拒绝。
- 方案 C：从 supported search paths 枚举 npm launcher，并 bounded follow symlink hops。vendor-neutral、无需新增 process probe，采用。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `semantic-code-navigation-provider`: external provider discovery 必须覆盖多个并存 npm runtime 与 symlink chains。

## 验收标准

- Homebrew npm 排在前、Hermes-style npm 排在后时仍能解析后者安装的 `pyright-langserver`。
- nested symlink 最终指向 `npm-cli.js` 时，runtime `bin` 仍被保留为 search candidate。
- Windows `.cmd/.bat/.exe/.ps1` launcher candidates 保持兼容。
- 真实 `pyright-langserver --stdio` initialize 返回 capabilities。

## Impact

- `src-tauri/src/backend/app_server_cli.rs` shared CLI resolution。
- 所有复用 `find_cli_binary` 的 npm-installed external tools。
- 无新增 dependency、IPC 或 frontend change。
