# Proposal: Codex 启动检测不执行外部 CLI

## Why

部分 macOS 用户本机存在旧版或证书异常的 `codex` CLI。当前应用启动会执行
`codex --version`，失败后还可能执行 `codex --help`，因此 macOS 会在用户刚打开
ccgui 时弹出“已阻止恶意软件”。这不是用户主动选择 Codex runtime 的结果，
启动检测不应该触发系统级安全弹窗。

## What Changes

- Codex engine 的 startup / background detection 改为 metadata-only：
  只解析 configured binary 或 PATH 是否能找到 `codex`，不执行该 binary。
- Codex 的真实可执行性检查继续保留在主动路径：doctor、installer post-check、
  app-server launch/capability probe。
- 保留内置 Codex model catalog、home dir 和 binary path 展示，让 UI 仍能渲染
  Codex 选项；如果用户真正选择 Codex 且本机 CLI 不可用，再由主动检查返回可读错误。

## Impact

- Affected spec: `engine-environment-doctor`
- Affected code:
  - `src-tauri/src/engine/status.rs`
