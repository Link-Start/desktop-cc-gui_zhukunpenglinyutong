## Context

Codex managed provider 使用 `codex::{workspaceId}::{providerProfileId}` runtime key，并将 provider config 物化到独立 `CODEX_HOME`。Claude CLI 的执行模型不同：每个 turn 都 spawn 一个短生命周期 `claude -p` child process，history/resume 默认共享 Claude home。现有实现已经在 primary send path 注入 `provider_env`，但 manager、MCP locator 与部分 secondary spawn 仍以 workspace-only state 工作。

约束：

- 必须保留 Claude history/resume/MCP 对现有 Claude home 的兼容性。
- `providerProfileId` request、durable binding 与 frontend thread metadata 已存在，不新增跨层 payload。
- control/cleanup 必须覆盖同一 workspace 下全部 provider runtime；turn interrupt 必须只命中持有该 turn 的 runtime。
- 当前 working tree 有独立 CC Switch 导入改动，本变更不得重写其文件内容。

## Goals / Non-Goals

**Goals:**

- 将 Claude runtime ownership 从 workspace-only 提升为 workspace + provider profile。
- primary send、legacy flag retry、auto-compact、AskUserQuestion/approval resume 使用同一 provider launch context。
- managed/local provider 并行时不串 env、session state、active turn 或 child ownership。
- provider 管理 UI 与 per-session contract 对齐；CLI header 响应式稳定。

**Non-Goals:**

- 不创建 provider-specific `CLAUDE_CONFIG_DIR`。
- 不迁移或复制 `.claude/projects` history。
- 不删除 legacy `vendor_switch_claude_provider` backend command。
- 不允许既有 thread 热切换 provider。

## Decisions

### D1. Claude runtime key 复用 Codex 的 ownership 形状

新增窄 helper：

```rust
claude_runtime_key(workspace_id, provider_profile_id)
```

- local / empty profile 使用稳定 local sentinel。
- managed profile key 包含 normalized provider id。
- `ClaudeSessionManager` 提供 provider-aware get/create/get/remove；legacy workspace-only API 保留为 local wrapper，降低 sibling caller 迁移风险。

采用 provider-aware key 而不是只修 env，是因为 `ClaudeSession` 内含 `session_id`、`active_turn_id`、pending user input、approval state 与 child registry。workspace-only object 无法证明并行 provider state 隔离。

### D2. runtime locator 与 provider id 分离

每个 `ClaudeSession` 持有不含 secret 的 opaque runtime locator。AskUser MCP URL 使用 locator 定位 session，而不是只按 workspace 取第一条 session，也不直接把未验证 provider id 拼进 URL path。

manager 通过 locator 查找当前 session。legacy workspace-only MCP URL 仅作为 local/default compatibility path；managed runtime 必须使用 locator-aware path。

### D3. provider launch context 作为 runtime immutable fact

managed `ClaudeSession` 创建时绑定 provider profile id；每次 send 仍从 request/durable binding 解析配置，以便 provider 删除或修改后 fail closed/读取最新值。resolved env 进入本次 turn 的 launch context，并按 `turn_id` 保存在 session 内，直到 turn 及 secondary spawn 完成。

secondary spawn 必须从 turn context 取 env：

- unknown `--include-hook-events` retry；
- automatic `/compact` 与 retry；
- AskUserQuestion kill-and-resume fallback；
- approval kill-and-resume fallback；
- 其他复用 `build_command` 的 same-turn restart。

context 清理必须与现有 ephemeral turn cleanup 同生命周期，错误与 interrupt 路径也必须释放；不得在日志输出 env value。

### D4. control path 使用 workspace scan，turn path使用精确 owner

- workspace interrupt/remove/shutdown：枚举该 workspace 的全部 Claude runtime，逐个 interrupt；只有成功终止的 owner 才移除。
- turn interrupt：搜索持有 `turn_id` 的 runtime，只中断该 child；找不到视为 idempotent no-op。
- settings binary 变化：移除全部 Claude runtimes，而不是对重复 workspace id 多次调用 local wrapper。
- diagnostics：允许同一 workspace 输出多条 runtime row，并附非敏感 runtime key/profile metadata；不能覆盖或合并 child pid。

### D5. 不物化 Claude provider home

方案 B（独立 `CLAUDE_CONFIG_DIR`）可提供文件级隔离，但会改变 history、resume、MCP servers、skills 与用户现有 settings 的可见性。本变更仅把 managed provider 的 network/auth/model env 作为 child-process override，同时共享 durable history home。

local/default runtime不注入 managed env，保持现有 disk/global behavior。managed runtime绝不调用 provider switch/write command。

### D6. UI 移除 global active provider 语义

`ProviderList`：

- local official card继续显示 local/default 状态与编辑入口；
- managed rows保持 reorder/edit/delete；
- status统一渲染“新会话可选” badge；
- 不再暴露 `onSwitch` button。

backend switch command与 persisted `current` 字段暂时保留读取兼容，避免历史配置或其他 host adapter 断裂；新 UI 不再产生写入。

### D7. CLI header 仅做 layout contract 修复

复用现有 DOM，不新增组件层：

- brand header/action 容器允许安全 wrap；
- copy 区 `min-width: 0`，action 区具备最大宽度与右对齐；
- version badge group和 lifecycle button group内部保持可换行；
- narrow viewport 转为纵向时占满可用宽度，不使用 absolute positioning 或 overflow clipping。

## Risks / Trade-offs

- **[Risk] AskUser MCP locator 改动影响 legacy local runtime** → 保留 workspace-only local fallback，并补新旧 URL/lookup tests。
- **[Risk] manager key 扩展导致 workspace cleanup 漏 owner** → 提供 manager-level `sessions_for_workspace` / `remove_workspace_sessions`，所有 workspace control path统一复用。
- **[Risk] provider config 编辑期间同一 thread下一 turn读取新 env** → 保持当前“每次 send 解析最新配置”的行为；binding id不变，删除则 fail closed。
- **[Risk] shared Claude history包含不同 provider会话** → 这是刻意的兼容选择；catalog binding继续负责 provider attribution。
- **[Risk] CSS 修改影响三种 CLI header** → 使用已有 feature-scoped selectors，并覆盖 Claude/Codex/Kimi header component tests。

## Migration Plan

1. 先增加 provider-aware manager API、runtime key与兼容 wrapper。
2. 迁移 desktop/daemon send获取对应 runtime。
3. 迁移 interrupt/remove/shutdown/diagnostics与 MCP lookup。
4. 补齐 secondary spawn launch context。
5. 调整 provider list语义与 header CSS。
6. 运行 focused Rust/Vitest、typecheck、runtime contracts、large-file check与 strict OpenSpec validation。

回滚时按相反顺序执行。新 manager key只存在内存，无持久化迁移；catalog binding格式不变。

## Open Questions

无。若实现证明 Claude CLI 某个 secondary spawn 无法可靠关联 `turn_id`，必须暂停并更新本 design，不允许 fallback local。
