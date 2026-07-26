## Context

当前 per-session provider binding 已贯通新建、持久化与 turn routing，但 model catalog 仍是 engine-global：

```text
active thread provider binding
  -> (dropped)
useEngineController(engineType)
  -> get_engine_models(engineType)
  -> engine manager global status/default config
  -> one engine-global frontend state/cache key
```

因此新建 managed-provider thread 后，模型菜单仍展示 disk/global provider 的 configured models。Codex provider custom models又被聚合进 global localStorage catalog，进一步造成跨 provider 泄漏。

约束：

- 保留 `EngineModelInfo[]` response shape，避免引入新的 catalog wrapper 与迁移。
- Desktop command、remote forwarding 与 daemon dispatch 使用同一 optional request field。
- provider profile 是 config trust boundary；missing/invalid managed profile 必须返回可诊断错误。
- model refresh 不得启动、重启或切换 conversation runtime。

## Goals / Non-Goals

**Goals:**

- model request/cache identity 变为 `engineType + normalized providerProfileId`。
- managed catalog = provider-owned configured models + engine public models + frontend public custom models。
- provider-owned entry 优先，按 normalized runtime model identity 稳定去重。
- active thread 快速切换时，stale provider response 不覆盖当前目录。
- local/disk profile 保持原 global config behavior。
- Codex managed provider 的 create/send model fallback 与 catalog 使用同一 profile config source。
- create-session runtime transport disconnect 只允许 same-provider bounded recovery。
- 三引擎 badge 使用统一 local/managed 语义。

**Non-Goals:**

- 不改 provider runtime launch/materialization。
- 不增加新的 model storage 或 provider schema。
- 不为 Gemini/OpenCode 增加 managed provider profile。

## Decisions

### 1. 扩展现有 `get_engine_models`，不新增平行 command

request 增加 optional `providerProfileId`：

```text
getEngineModels(engineType, { providerProfileId, forceRefresh })
  -> get_engine_models(engineType, providerProfileId?, forceRefresh?)
```

未提供、空白或 engine 对应 local/disk sentinel 时走现有 global catalog。managed id 由现有 Claude/Codex/Kimi provider resolver 读取，不存在或配置无效时返回 `Err`。

备选是新增 `get_provider_models`；它会复制 refresh、remote forwarding、daemon dispatch 与 error handling，因此不采用。

### 2. Backend 只合并可证明为 public 的模型

managed catalog 的 backend merge 顺序：

1. provider-owned configured models
2. engine generated/built-in public catalog

Claude 从 `settingsConfig.env` 的 supported model keys 生成 provider entries；Codex 从 `configToml.model` 与 profile `customModels` 生成；Kimi 从 profile `model/displayName` 生成。disk/global configured models不得混入 managed catalog。

Frontend 再追加 user-level public custom models。Codex custom model带 `providerProfileId` 时，仅保留当前 profile 的 entry；不带 origin 的 entry 视为 public。Claude custom models按现有 contract 为 public。去重 identity 使用 normalized runtime `model`，缺失时使用 `id`；provider entry 和 user custom label优先于 built-in。

备选是把 global engine status 整体当 public catalog；它含 disk/global configured entries，会重现当前串供应商问题，因此不采用。

### 3. Active thread binding 驱动 catalog refresh

复用 `useThreads.getThreadProviderProfileId()` 的 ref-backed lookup。把现有 Claude pending-thread refresh hook 泛化为 active provider catalog sync：

```text
activeWorkspaceId + activeThreadId + activeEngine
  -> resolve persisted providerProfileId
  -> refreshEngineModels(activeEngine, { providerProfileId })
```

`useEngineController` 的 startup-orchestrator id/dedupe key包含 normalized profile scope，并用 latest request key拒绝 stale response。provider-scoped refresh只更新当前可见 `engineModels`，不覆盖 engine-global `EngineStatus.models`。

备选是在 `useEngineController` 之前提升 thread state；这会重排 AppShell 根 hook 链并增加 render 风险，因此不采用。

### 4. Composer 显式接收 active profile scope

`activeThreadSummary.providerProfileId` 沿既有 `useLayoutNodes -> Composer/ChatInputBoxAdapter -> ChatInputBox` presentational props 下传，只用于 model catalog composition。Codex localStorage custom models按 scope过滤，避免 selector 在 backend 已正确返回 provider catalog后重新注入其他 managed provider 模型。

### 5. Badge 只保留通用语义 key

Claude、Codex、Kimi local/disk row统一使用 `providerFollowsGlobalLabel`，managed row统一使用 `providerIsolatedConfigLabel`。删除不再使用的 Codex 专用文案 key，避免后续漂移。

### 6. Codex create/send fallback 必须与 provider runtime 同源

`start_thread` 当前先解析 workspace disk/default model，再启动 selected provider runtime，形成“runtime 按 provider 隔离、model 仍按 global 注入”的半隔离状态。修复后统一通过 provider-scoped fallback resolver：

```text
disk profile -> existing workspace/default fallback
managed profile -> selected profile configToml.model
managed profile without model -> None（省略 request model）
```

`send_user_message` 在调用方未显式提供 model 时复用同一 resolver。managed profile missing/invalid 必须 fail closed，不得读取 disk/default model。

### 7. Pipe disconnect 使用 same-provider bounded retry

`Broken pipe`、closed pipe 等错误表示 app-server transport 已断开，不是可直接展示的产品错误。复用现有 create-session runtime retry owner：

1. 首次 transport disconnect 触发 lifecycle recovery probe。
2. `ensure_codex_session_for_provider` 以原 `providerProfileId` 清理 stale runtime 并重建。
3. `thread/start` 只重试一次。
4. 重试仍为 transport disconnect 时返回 `[SESSION_CREATE_RUNTIME_RECOVERING]`，不携带 raw OS error。

frontend 增加 compatibility classifier，兼容旧 daemon/remote backend 仍返回 raw pipe error 的情况；只显示既有 recoverable toast，不调用 native `alert`。任何路径都不得切换到 `__disk__`。

## Risks / Trade-offs

- [Risk] 快速切换 thread 时旧请求晚返回 → `engineType + providerProfileId` latest-key guard 丢弃 stale publish。
- [Risk] provider 被删除后 active thread 无法刷新 → fail closed，保留 last-good visible catalog并记录 debug error；不请求 default catalog。
- [Risk] Codex public custom model与 provider model同 identity但标签不同 → provider/profile custom entry先入，public entry仅补缺，保证 provider label胜出。
- [Risk] local/disk sentinel 在三个引擎不同 → 在 shared scope normalizer中按 engine识别现有常量，不发明统一 persisted ID。
- [Risk] provider 名称恰好为 `Kimi` 被误认为 Kimi CLI → routing 与测试只使用 `engine=codex + providerProfileId`，严禁按 profile name 推断 engine。
- [Risk] pipe retry 造成重复 thread → 仅在 transport 未返回成功 response 时重试一次；binding 仍只在取得 thread id 后记录。
- [Trade-off] response仍为数组，scope metadata不进入 DTO wrapper → 由 request identity与 active profile prop表达 scope，减少 contract churn。

## Migration Plan

1. 添加 optional payload与 shared backend provider catalog resolver；旧调用不传字段，行为不变。
2. 更新 frontend controller/cache与 active thread sync。
3. 更新 Composer scoped custom merge与 badge文案。
4. 修正 Codex provider-scoped create/send fallback，并扩展 create-session transport retry。
5. 执行跨层、三引擎、transport recovery 与 race regression tests。

Rollback 可整体撤回 optional field与 scoped sync；无 storage/schema migration，无数据回滚。

## Open Questions

- 无。用户已确认 public/common models 必须追加，并整体去重。

### 10. Active Composer Repair 必须同步内存事实

provider catalog hydration 可能发现已持久化 effort 与当前 model capability 不一致。repair owner
调用 `persistComposerSelectionForThread` 后，cache、store 与 active selection state 必须在同一
次更新中收敛：

```text
repair selection
  -> normalize once
  -> update session cache/store when changed
  -> update active selection ref/state when target is active thread
  -> next render observes repaired value and stops
```

仅写 cache/store 会让 Composer effect 继续读取旧 active selection；同时 cache state 更新会改变
上层 resolver identity，扩大根 hook 链的重复 render 风险。修复放在 shared persistence owner，
不在各个 repair caller 增加局部 guard。
