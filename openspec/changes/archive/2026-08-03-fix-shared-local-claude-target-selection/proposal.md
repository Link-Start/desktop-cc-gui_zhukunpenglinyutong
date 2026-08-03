## Why

Shared Session 的双栏 model picker 从 Codex CLI 浏览到 Claude Code 的首个
`Local Settings.json` Provider 时，当前 frontend 可能复用 engine-global stale catalog。
这会让用户看到可用模型却无法持久化对应 `ExecutionTarget`，而 managed Claude Provider
因读取 provider-scoped catalog 不受影响。

## 目标与边界

- 让 Shared Session 从任意 CLI 切换到 Claude local Provider 后，能选择并持久化真实
  runtime model。
- local Provider 的 catalog 在用户展开时按 binding scope 重读，避免 frontend cache 与
  backend disk validation 使用不同快照。
- 保持 `modelCatalogEntryId`、runtime `model`、display label 三种身份分离。
- 保持 backend fail-closed persistence validation，不放宽 catalog membership。
- 让 Native 单栏与 Shared 双栏复用同一 normalized Provider binding identity，恢复
  Provider / Model 选中勾选。

## 非目标

- 不改双栏 selector 的视觉、布局或 keyboard interaction。
- 不改变 managed Provider cache policy、Native Session runtime 或 launch 协议。
- 不通过 display label 猜测 runtime model；legacy row 仅采用 backend 已定义的
  non-empty catalog `id` compatibility fallback。
- 不修改 Shared send、binding provisioning 或 conversation state machine。

## What Changes

- local/disk Provider model catalog 在同一 picker catalog owner 首次展开时绕过跨组件
  stale cache，并请求 provider-scoped forced refresh；同 scope 的 concurrent / repeated
  activation 仍然合并或复用已完成结果。
- Shared selector 优先使用明确 runtime model；legacy row 与 backend validation 一致，
  使用 non-empty catalog `id` 作为 compatibility runtime model，同时保留 catalog entry id
  与 runtime model 的独立字段。
- Provider 选中态统一按 `engine + normalized providerProfileId` 判断，不再把
  `providerProfileSource` metadata 当作 Native 必填 identity。
- 增加 Codex → Claude local 首项、`catalog id != runtime model`、local cache stale 与
  fail-closed 边界的 focused regression tests。

## 方案对比

### 方案 A：放宽 backend validation

让 backend 接受任意 UI model 或 display label。改动小，但会破坏 catalog membership
安全边界，并可能把错误 Provider/Model 静默写入 Shared metadata，不采用。

### 方案 B：local picker 展开时刷新 authoritative catalog

只在用户显式展开 local/disk Provider 时按 binding scope 强制重读；managed Provider
继续复用 cache，backend validation 保持严格。该方案把 UI 与 persistence 对齐，并将性能
成本限制在低频交互边界，采用。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `composer-control-surface`: Shared 双栏 picker 选择 Claude local model 时必须提交一次
  带独立 catalog/runtime identity 的完整 `ExecutionTarget`。
- `provider-model-catalog-refresh`: local/disk Provider 的显式展开必须读取当前 binding 的
  authoritative configured catalog，且 concurrent refresh 仍按 binding 去重。

## Impact

- Frontend hook：Shared Provider Profile catalog lazy-load/cache policy。
- Frontend selector tests：跨 CLI local Provider model selection。
- OpenSpec delta：Composer interaction 与 Provider catalog refresh contract。
- 无新增 dependency、无 storage migration、无 backend API shape 变更。

## 验收标准

- Shared Session 当前为 Codex CLI 时，选择 Claude Code → Local Settings.json →
  `kimi-for-coding` 后，picker 关闭且 selected target 切到 Claude local。
- target 同时保留 `modelCatalogEntryId = settings-main` 与
  `model = kimi-for-coding`，不得用 label 或 catalog id 覆盖 runtime model。
- local catalog stale cache 不得覆盖最新 disk catalog；同 scope 并发加载只产生一个请求。
- runtime `model` 为空但 catalog `id` 非空的 legacy row 可点击，并提交同值
  catalog/runtime identity；已知 `id != model` 仍不得混用。
- Native synthesized target 缺失 `providerProfileSource` 时，当前 Provider / Model 仍显示勾选。
- focused Vitest、TypeScript typecheck、lint、runtime contracts 与 OpenSpec strict validation
  通过。
