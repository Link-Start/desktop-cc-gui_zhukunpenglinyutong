## Why

当前模型菜单把“重读本地/Managed Provider 配置”与“从 CLI runtime 获取可用模型”混成一次刷新：请求虽可到达 backend，但 Provider-scoped picker 仍可能消费独立 cache，失败也可能退回旧 catalog 后表现为成功。普通 Composer 与 Shared Session 必须共享同一套分源刷新与合并契约，才能保证用户看到的模型目录与目标 Provider 一致。

## 目标与边界

- 在 Provider 标题区提供两个独立动作：`Reload Config` 与 `Discover Models`。
- `Discover Models` 仅复用 CLI/runtime 已公开的 model-list protocol；禁止新增 HTTP model discovery。
- 两个动作都按 `engine + providerProfileId` 更新当前模型框，并同步覆盖普通 Composer 与 Shared Session Target Picker。
- Provider custom models、configured models、CLI-discovered models 与 fallback models 分源保留、稳定合并。
- 失败保留 last-good catalog 与当前选择，同时暴露可诊断错误。

## 非目标

- 不为没有 model-list protocol 的 CLI 伪造命令或解析 help 文本。
- 不把 CLI discovery 结果自动写回 Provider 配置。
- 不改变 Shared Session send/continuation payload、Provider binding 或持久化 schema。
- 不引入 HTTP endpoint probing、后台轮询或全局 catalog store 重构。

## What Changes

- 增加 Provider-scoped catalog action contract，区分 config reload 与 CLI discovery。
- 为 catalog entry 保留 source/provenance，并按 runtime model identity 合并 Custom、Configured、CLI-discovered、last-good 与 fallback。
- 让 Shared Session 展开的目标 Provider Profile 与普通 Composer 使用同一 refresh owner、cache key 和 stale-response guard。
- 仅在目标 CLI/runtime 支持 model-list 时展示或启用 `Discover Models`；Claude Code 等不支持者不得伪装成功。
- 让刷新错误穿透到当前 Provider Profile UI；旧 catalog 可继续选择但必须标记 stale/error。

## 技术方案取舍

### 方案 A：统一 Provider-scoped catalog owner（采用）

扩展现有 `useSharedProviderTargetCatalog`，让 native Composer 与 Shared Session 共用 config/discovery action、cache invalidation 和 merge。改动集中，能直接消除两套 catalog 漂移。

### 方案 B：普通 Composer 与 Shared Session 分别刷新（拒绝）

初始 diff 较小，但两个 cache、错误处理和 source precedence 会继续分叉，无法保证 Shared Target 与普通 Composer 一致。

### 方案 C：重构为全局 model catalog store（拒绝）

长期统一性更强，但会扩大到 Kanban、Project Map 等无关消费者；本次需求不需要该重构。

## Capabilities

### New Capabilities

- `provider-model-catalog-refresh`: 定义 Provider-scoped config reload、CLI discovery、分源 merge、capability gate、last-good 与错误契约。

### Modified Capabilities

- `composer-control-surface`: 普通 Composer 的双动作与当前 Provider Profile catalog 收敛。
- `shared-session-engine-selection`: Shared Session Target Picker 必须刷新当前展开 binding，并与普通 Composer 共用 catalog。
- `claude-dynamic-model-discovery`: 明确 Claude Code 无 model-list protocol 时只允许重读配置，不得伪造 CLI discovery。
- `codex-model-catalog-coverage`: Codex runtime `model/list` 作为 CLI discovery source，并与 configured/custom/fallback 合并。

## Impact

- Frontend：`ModelSelect`、`ChatInputBox`、`useSharedProviderTargetCatalog`、engine model refresh wiring。
- Bridge：`getEngineModels` / Codex runtime model-list 现有调用与 typed capability metadata；不新增 HTTP command。
- Backend：仅补充 CLI discovery capability/result 映射；保持 Desktop/daemon payload
  contract parity，daemon 对尚未支持的 managed runtime 显式 fail closed。
- Tests：Provider-scoped cache、双动作、Shared Target、stale/error、service mapping 与 focused Rust/TypeScript contract tests。

## 验收标准

- Config reload 成功后，当前 binding 的 configured/custom catalog 立即替换旧 config slice。
- CLI discovery 成功后，只替换 discovered slice；custom/configured entries 不丢失。
- Shared Session 展开 Provider B 并刷新时，请求与 UI 更新都锁定 Provider B，Provider A 的晚响应不得覆盖。
- 不支持 model-list 的 CLI 不发 discovery 请求，不展示虚假成功。
- 任一刷新失败时保留 last-good 与当前 selection，并在对应 Provider Profile 显示错误。
- focused frontend/service/Rust tests、typecheck、lint 与 runtime contract checks 通过；不要求全量 test suite。
