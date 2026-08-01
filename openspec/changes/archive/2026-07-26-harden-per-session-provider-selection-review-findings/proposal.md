## Why

`unify-per-session-provider-selection` 已完成主链路，但提交级 review 发现 canonical identity、Kimi interrupt、provider home 写入安全和 catalog failure fallback 仍存在边界缺陷。若不修复，会出现重启后丢绑定、跨 provider turn 被误判中断、API key temp file 权限窗口，以及 managed selection 静默改走 local/default。

## 目标与边界

- 只修复上述 review findings，不扩展新的 provider 产品能力。
- 保持现有 request payload 与 thread metadata 向后兼容。
- Desktop 与 daemon 必须保持同一 binding persistence 语义。
- 仅运行受影响的 incremental tests。

## 非目标

- 不重构 engine registry、model catalog 或 vendor management UI。
- 不改变 OpenCode/Gemini retirement 策略。
- 不修改消息幕布、Markdown renderer 或 streaming dispatch 架构。

## What Changes

- canonical `SessionStarted` 出现时，将 pending/parent 上的 managed binding 幂等写入 canonical session key。
- Kimi turn interrupt 只标记真实拥有目标 turn 的 runtime，cleanup failure 保留 child owner。
- Kimi provider TOML 写入增加 file lock、owner-only temp creation、失败清理和 unchanged no-op。
- provider catalog 加载失败时显式提示；记住的 managed selection 不得静默回退 local/default。
- 增加对应 Rust/Vitest regression tests 与 review evidence。

## 技术方案对比

1. 在 frontend identity rename 后新增 binding migration command。优点是 UI 已知 old/new id；缺点是增加 IPC surface，且 backend durable contract 依赖 frontend side effect。
2. 在 backend `SessionStarted` event forwarder 内直接持久化 canonical binding。优点是 identity 事实与持久化同源，desktop/daemon 可复用同一 path-only helper；缺点是需要在 forwarder 中显式记录失败日志。

选择方案 2。canonical identity 来自 runtime，durable binding 应在 runtime/backend owner 边界闭环。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `engine-per-session-provider-binding`: canonical identity 首次出现时必须持久化 managed binding，provider catalog failure 不得导致静默跨 provider fallback。
- `kimi-engine-runtime`: turn interrupt 必须限定真实 owner；provider home 写入必须并发安全且 secret temp file 从创建起 owner-only。

## Impact

- Backend：`session_management.rs`、Claude/Kimi desktop/daemon event forwarder、`engine/kimi.rs`、`engine/kimi_provider_profile.rs`。
- Frontend：`Sidebar.tsx`、`useSidebarMenus.ts` 及定向测试/i18n。
- Storage：workspace catalog metadata 与 `~/.ccgui/kimi-provider-homes/**/config.toml`。
- 无新增 dependency，无 breaking API。

## 验收标准

- Kimi/Claude canonical identity 在首轮完成后、无需第二次 send 即可从 catalog 恢复 provider。
- interrupt provider A 的 turn 不影响 provider B 正常完成。
- Kimi temp file 创建时即为 0600；并发 materialization 不产生丢文件或 replace race。
- provider catalog load failure 有可见错误；remembered managed id 不自动变成 local/default。
- targeted Rust tests、targeted Vitest、TypeScript、runtime contracts、strict OpenSpec validation 全部通过。
