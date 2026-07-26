## Why

Codex managed provider 使用已被当前 Codex CLI 移除的 `wire_api = "chat"` 时，app-server 会在配置加载阶段退出；当前创建会话链路随后只暴露 `Broken pipe (os error 32)`，用户无法判断真正的协议不兼容原因。系统应在启动 runtime 前识别该配置，并给出可操作、不会误导用户的本地化提示。

## 目标与边界

- 仅处理 `engine=codex` 的 managed provider `configToml` 协议预检与 create-session 友好提示。
- provider 名称只是 display metadata；不得按 `Kimi`、`MiniMax` 等名称分支。
- backend 保留稳定诊断标识，frontend 负责用户可读的本地化 copy。
- 明确区分“供应商支持 Responses API”与“供应商仅支持 Chat Completions”两种修复路径。

## 非目标

- 不实现 Responses ↔ Chat Completions 协议转换。
- 不自动把 `wire_api = "chat"` 改写为 `"responses"`。
- 不修改 Kimi CLI engine 或其他 engine 的 provider routing。
- 不调整 provider 模型目录、会话绑定或 runtime retry 行为。

## What Changes

- 在 Codex managed provider runtime materialization 前解析完整 `configToml`，检测任一 provider table 中当前 Codex CLI 不支持的 `wire_api = "chat"`。
- 返回稳定、可分类的 provider protocol error，阻止无意义的 app-server spawn/retry。
- create-session frontend 将该错误转换为本地化、可操作的协议兼容提示，不再向用户展示 `Broken pipe` 或 OS error code。
- 增加 backend Good/Base/Bad case 与 frontend error mapping 回归测试。

## 方案对比

1. **启动前 config preflight（采用）**：根因位置明确、无需启动子进程、不会产生二次 pipe error，最小且确定。
2. **捕获 app-server stderr 后反推根因（不采用）**：依赖进程时序与 stderr 文案，仍可能先收到 pipe disconnect，跨版本脆弱。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `codex-provider-scoped-session-launch`: managed provider 创建会话前必须验证 Codex wire protocol；不兼容时返回稳定错误并展示可操作提示。

## Impact

- Backend：`src-tauri/src/codex/provider_profile.rs` 及其 focused tests。
- Frontend：`src/features/app/hooks/useWorkspaceActions.ts`、focused tests、errors locale copy。
- Contract：不修改 Tauri command signature 或 payload；只增加稳定 error classification。
- Dependencies：无新增依赖，复用现有 `toml` parser 与 create-session error mapping。

## 验收标准

- 任一 provider table 含 `wire_api = "chat"` 的 Codex managed provider 在 app-server 启动前失败。
- UI 明确提示当前 Codex CLI 不支持 `chat`，并说明 Responses 或协议转换两条处理路径。
- UI 不显示 `Broken pipe`、`os error 32`。
- `wire_api = "responses"` 与未配置 `wire_api` 的现有 provider 行为不变。
- 不读取、记录或输出 provider API key。
