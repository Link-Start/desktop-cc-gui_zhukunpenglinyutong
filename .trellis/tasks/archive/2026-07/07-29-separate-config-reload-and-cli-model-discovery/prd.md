# Separate Config Reload And CLI Model Discovery

## Goal

实现 Provider-scoped `Reload Config` 与 CLI-only `Discover Models`，并让普通 Composer 与 Shared Session 共用同一模型 catalog。

## Requirements

- Discovery 仅走已验证 CLI/runtime model-list protocol，禁止 HTTP。
- Config 与 discovered catalog 分源更新，custom models 不丢失。
- Shared Session 刷新当前展开 Provider binding，不回读 active thread/global selection。
- 失败保留 last-good 与当前选择，错误可诊断。
- 不支持 model-list 的 CLI 隐藏或禁用 discovery。

## Acceptance Criteria

- [ ] Codex Provider-scoped app-server `model/list` 支持 Desktop/daemon parity。
- [ ] 两个 icon action 更新同一 binding 模型框。
- [ ] 普通 Composer 与 Shared Session 共用 catalog cache 与 stale guard。
- [ ] focused frontend/service/Rust tests、lint、typecheck、runtime contract 通过。
- [ ] OpenSpec strict validation 通过；按用户授权不跑全量测试。

## Technical Notes

OpenSpec change: `separate-config-reload-and-cli-model-discovery`。
