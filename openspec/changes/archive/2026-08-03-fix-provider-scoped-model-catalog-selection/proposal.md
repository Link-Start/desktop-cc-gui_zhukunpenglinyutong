## Why

新建会话已经能绑定 Claude Code、Codex、Kimi CLI 的具体供应商，但模型目录请求仍只按 `engineType` 读取全局/default 配置，导致用户选中 managed provider 后看到错误模型，且不同供应商的并行会话会共享同一目录。同时，三个引擎对 local/managed 配置的 badge 文案不一致，增加理解成本。

## 目标与边界

- 新会话绑定供应商后，模型菜单读取该供应商配置对应的模型，并追加该引擎的公共模型。
- 供应商专属模型优先于同 ID 公共模型，最终按稳定 model ID 整体去重。
- 模型目录、refresh 与 cache identity 使用 `engineType + providerProfileId`，不同供应商互不污染。
- Codex managed provider 创建会话和无显式模型发送时，只使用该 profile 的默认模型；不得注入 disk/workspace fallback model。
- Codex `thread/start` 遇到 runtime pipe disconnect 时，在同一 provider identity 内有界重建并重试；失败时不得向 UI 暴露 raw OS pipe error。
- Claude Code、Codex、Kimi CLI 的供应商 badge 统一为“跟随全局配置”与“独立配置”。

## 非目标

- 不改变 provider binding 持久化语义，不允许 managed provider recovery 切换到 disk/default provider。
- 不新增供应商管理能力、模型编辑入口或第三方依赖。
- 不改变未绑定/local profile 会话读取 disk/global config 的既有行为。

## What Changes

- 扩展 frontend service、Tauri command 与 daemon request，使 model catalog request 可携带 `providerProfileId`。
- 为 managed provider 解析 provider-owned model facts，并与当前 engine public catalog 合并；同 model ID 时 provider-owned entry 胜出。
- 将 model catalog cache、in-flight dedupe 与 refresh scope 改为 provider-scoped identity。
- Composer 按 active thread 持久化的 provider binding 选择模型目录；missing managed profile fail closed，不静默回退到 default。
- 修正 Codex session creation/send fallback：managed provider 从自身 `configToml.model` 解析默认模型；仅 disk profile 允许 workspace/global fallback。
- 将 `Broken pipe` 等 runtime transport disconnect 纳入同-provider bounded retry；重试耗尽时转换为稳定 recovery error，frontend compatibility guard 不弹 raw OS error。
- 统一三个引擎供应商选择菜单的 local/managed badge 文案。
- 增加 Claude Code、Codex、Kimi CLI 的 provider isolation、public merge、dedupe 与 local/default 回归测试。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `model-provider-catalog-runtime`: 模型目录 identity 从 engine-only 扩展为 engine + provider，并规定 provider models 与 public models 的合并、优先级及去重。
- `composer-control-surface`: Composer 必须按当前会话 provider binding 解析目录，不能继续显示 default provider 的模型。
- `engine-per-session-provider-binding`: 新会话供应商 badge 使用一致语义，且 managed profile 缺失时模型目录不得静默回退。

## 方案对比与取舍

1. **推荐：扩展共享 model catalog contract。** 在现有 `get_engine_models` 链路增加 optional `providerProfileId`，由 backend 复用现有 provider profile resolver，统一完成 provider/public merge。优点是 Desktop/daemon parity、cache isolation 与错误语义集中；改动跨层但根因只修一次。
2. **备选：frontend 直接解析 provider 配置。** 改动看似局部，但会复制 Rust resolver、泄漏配置格式细节，并使 Desktop/daemon、refresh 与 cache 更易漂移，因此不采用。

## 验收标准

- 选择 managed Claude/Codex/Kimi provider 创建会话后，模型菜单包含该 provider 配置模型与公共模型，不包含其他 managed provider 的专属模型。
- 选择 Codex managed provider 创建会话时，`thread/start.model` 来自该 provider，配置未声明 model 时省略字段；不得使用 disk/global model。
- Codex create-session 首次 pipe disconnect 自动重建同 provider runtime 并重试一次；持续失败只显示可恢复提示，不显示 `Broken pipe (os error 32)`。
- provider 模型与公共模型 ID 相同时只显示一次，provider label/metadata 优先。
- 同 workspace 并行打开不同 provider 会话，切换会话时模型目录同步切换且 cache 不串用。
- local/disk profile 保持读取全局配置；managed profile 被删除或读取失败时给出可诊断错误，不回退 default。
- 三个引擎 badge 统一显示“跟随全局配置”或“独立配置”。

## Impact

- Frontend：sidebar menu、engine model controller/catalog projection、Composer active-thread catalog selection、Tauri bridge DTO。
- Backend：`get_engine_models` Tauri command、daemon request dispatch、Claude/Codex/Kimi provider profile model resolution。
- Specs/tests：model catalog runtime、Composer control surface、per-session provider binding 及对应 TypeScript/Rust regression tests。
- Dependencies/storage：无新增依赖，无持久化 schema migration。
