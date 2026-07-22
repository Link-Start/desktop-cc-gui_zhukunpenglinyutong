## Context

`FileViewNavigationPanel` 已持有 normalized `language` 与 `fallbackReasonCode`，因此不需要 backend/API 变更。现有 fallback note 是最接近用户问题的 surface。

## Goals / Non-Goals

**Goals:**

- 从 `language + desktop platform` 纯函数生成一条 bounded command hint。
- 仅对 `provider-unavailable` render，command 文本可选择并可复制。
- 使用现有 platform helper 与 theme token，不增加 root state、effect、polling 或 IPC。

**Non-Goals:**

- 不执行 command，不检查 package manager，不自动安装。
- 不把 timeout、process exit、invalid response 映射成安装问题。

## Decisions

### 1. Pure matrix helper

在 file navigation utility 中定义 `macos | windows | linux` 与 Java/TS-JS/Rust command matrix。component 只消费结果，unit test 可不依赖真实 OS。

Alternative：在 JSX 内多层判断。拒绝，难覆盖 3×3 matrix，也容易让 platform copy 漂移。

### 2. Java Windows/Linux 显示官方下载入口 command

macOS 有稳定 Homebrew formula，直接显示 `brew install jdtls`。Windows/Linux 没有统一、可信、普遍存在的 package manager command，因此分别使用 PowerShell `Start-Process` 与 Linux `xdg-open` 打开 Eclipse milestone page，并明确标为“打开安装说明”，不伪装成一键安装。

### 3. Local copy feedback

复制状态只保留在 panel local state；不写 AppShell/store，不触发 toast 或 backend。clipboard 缺失时仍保留 selectable `<code>`。

## Risks / Trade-offs

- [Risk] Linux 缺少 `xdg-open` → command 仍清晰暴露官方 URL，可手工打开。
- [Risk] npm/rustup 未安装 → 本轮只做建议，不扩展 prerequisite detector。
- [Trade-off] Windows/Linux Java 不是一键安装 → 换取不提供错误或发行版特定命令。

## Migration Plan

纯 UI additive change，无数据迁移。回滚 helper、copy keys 与 hint block 即恢复原 fallback note。

## Open Questions

无；完整 installer/settings 后续独立立项。
