## Context

Codex managed provider 的 `configToml` 已在 `provider_profile.rs` 中通过 `toml::Value` 解析，并在 materialization 后写入独立 `CODEX_HOME/config.toml`。当前 Codex CLI 在 config load 阶段拒绝 `wire_api = "chat"`，子进程提前退出；`WorkspaceSession::send_request("initialize")` 随后写入已关闭 stdin，只得到 `Broken pipe`。create-session retry 能处理 transport 断开，却无法修复确定性的无效协议配置。

## Goals / Non-Goals

**Goals:**

- 在子进程启动前识别 managed provider 的 unsupported `chat` wire protocol。
- backend 返回稳定 marker，frontend 映射为本地化、可操作提示。
- 保持 provider identity、模型选择、retry 和 Tauri payload 不变。
- 使用 focused tests 锁定 `chat`、`responses`、missing 三种边界。

**Non-Goals:**

- 不实现协议转换或 endpoint capability probing。
- 不按 provider name、base URL 或 model name 推断供应商类型。
- 不自动修改用户配置。
- 不把所有 app-server stderr 都升级为 UI error contract。

## Decisions

### Decision 1：在 shared provider config parser 做 fail-fast

新增 pure validator，复用现有 `toml::Value` parse result，遍历 `[model_providers]` 中所有 provider table。任一 `wire_api` 为 `chat` 时返回带稳定 marker 的错误。Codex 在 config load 阶段反序列化完整 provider map，因此未被 top-level `model_provider` 选中的无效 table 同样会导致进程退出。

选择该位置的原因：

- Desktop managed create/session runtime 均经过 provider profile resolver/materializer。
- 在文件落盘和 process spawn 前失败，没有 pipe race。
- 不污染通用 transport retry classifier。

替代方案：从 app-server stderr 捕获 Codex 配置错误。拒绝，因为 stderr reader 与 stdin write 存在竞态，且上游文案可能变化。

### Decision 2：错误 marker 与用户 copy 分层

backend error 使用稳定 marker：

```text
[codex_provider_wire_api_unsupported]
```

并保留不含 secret 的 protocol/provider context。frontend 的 create-session error resolver 只按 marker 分类，返回 i18n copy；debug payload 保留原 backend message 便于诊断。

替代方案：backend 直接返回中文。拒绝，因为破坏 locale separation，也不利于 daemon/remote parity。

### Decision 3：提示不承诺强制改成 responses 一定可用

copy 同时说明：

1. 若上游支持 Responses API，可配置 `wire_api = "responses"`。
2. 若上游只支持 Chat Completions，需要协议转换/router。

这避免把 create-session 成功误当成首次模型请求一定成功。

### Decision 4：协议错误复用全局 Error Toast

`[codex_provider_wire_api_unsupported]` 使用现有 `pushErrorToast` 展示为 sticky error toast，标题与正文继续走 i18n。该错误不需要用户确认，不使用原生 `window.alert`，也不新增 Modal/Dialog 状态。其他未分类 create-session error 保持原有展示行为。

替代方案：使用 `ConfirmDialog`。拒绝，因为不存在 confirm/cancel 决策，强制二次确认会制造错误语义。

### Decision 5：TOML parse error 与协议错误使用独立 marker

shared Codex provider parser 对非法 TOML 返回 `[codex_provider_config_invalid]`。Frontend 仅展示本地化修复建议；backend 丢弃可能携带 source excerpt 的 raw parser diagnostic，只把稳定 generic marker/message 传入现有 Debug payload。这样既保留错误分类能力，也避免 parser source excerpt、line/column 和配置内容进入 UI 或日志。

### Decision 6：renderer 生产代码禁用 native Alert

所有普通错误反馈复用现有 `pushErrorToast`。`.eslintrc.cjs` 同时使用 `no-restricted-globals` 与 `no-restricted-properties`，分别阻止 `alert()` 与 `window.alert()`；测试文件关闭这两条限制，以允许 negative assertion 与 security fixture。需要用户确认的交互继续使用现有 Dialog/Confirm contract，不能用 Alert 代替。

## Risks / Trade-offs

- [Risk] 未来 Codex CLI 重新支持 `chat` → validator 与当前产品支持矩阵同步移除；稳定 marker 便于单点回滚。
- [Risk] `wire_api = "chat"` 位于未被 top-level `model_provider` 引用的 table → 仍须阻断，因为 Codex 会解析完整 provider map；错误 detail 指明具体 table id，便于用户清理。
- [Risk] config 缺少 `model_provider` 或 `wire_api` → 保持现有 Codex parser 权威，不新增猜测性阻断。
- [Trade-off] 只覆盖确定的 `chat` incompatibility，不泛化所有配置错误；其他错误继续使用既有链路。
- [Trade-off] production Alert 禁令会迁移现存少量调用点；换取统一 styling、非阻塞行为、i18n 与可测试性。

## Migration Plan

1. 新增 backend validator 与 unit tests。
2. 增加 frontend marker classifier、全局 sticky Error Toast、i18n copy 与 hook tests。
3. 迁移现存 renderer Alert、增加 ESLint guard 与 Trellis code-spec。
4. 执行 focused tests、typecheck、runtime contracts、OpenSpec strict validation。
5. 回滚时删除 validator 调用、marker mapping 与 ESLint guard；无数据迁移。

## Open Questions

无。协议转换属于独立能力，不在本变更实施。
