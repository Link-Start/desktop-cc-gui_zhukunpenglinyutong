# Replace language server fallback with install guidance

## OpenSpec

- Change: `replace-language-server-fallback-with-install-guidance`

## Goal

`provider-unavailable` 时用可执行的安装指引直接替换 generic fallback 提示。

## Requirements

- Java/macOS 显示 `未检测到语言服务 · Java` 与 `brew install jdtls`。
- 不显示旧的 generic fallback copy。
- 保留复制命令与安装后重新检测；retry 绕过旧 cache。
- 非安装故障保持既有提示。
- 不跑全量测试。

## Acceptance Criteria

- [ ] focused component test 覆盖 command、旧提示消失和 retry。
- [ ] TypeScript typecheck 通过。
- [ ] OpenSpec strict validation 通过。
- [ ] macOS App build 通过。

## Technical Notes

复用现有 `getLanguageServerInstallHint`、`onRetryNavigation` 和 fallback status row；不改 backend contract。
