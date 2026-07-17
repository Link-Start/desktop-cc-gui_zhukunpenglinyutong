## Why

Codex composer 当前在 runtime `model/list` metadata 缺失时，会把同一组静态 reasoning effort 注入所有内置模型，导致不同大模型的强度选项和默认值失真；同时 UI allowlist 尚未识别 CLI 已返回的 `ultra`。需要恢复“模型返回值是 capability truth”的契约，同时保留可控的 degraded fallback。

## 目标与边界

- runtime `model/list` 返回的 `supportedReasoningEfforts` 与 `defaultReasoningEffort` 优先于本地默认值。
- 允许共享一组公共 fallback，仅在对应 runtime 字段缺失时逐字段补齐。
- Composer 能展示并发送 CLI 返回的已知 `ultra` effort。
- 保持现有模型目录、custom model 与线程级 selection 恢复流程不变。

## 非目标

- 不修改 Codex app-server protocol 或 Rust `model/list` 转发结构。
- 不为未知第三方 effort 自动生成 UI 文案或图标。
- 不改变 Claude、Gemini、OpenCode 的 reasoning contract。

## What Changes

- 重构 Codex catalog capability merge，使 runtime model metadata 按字段覆盖公共 fallback。
- 将公共 fallback 收敛为明确的 degraded/default metadata，不再冒充每个模型的最终能力。
- 扩展 Composer reasoning effort 类型、normalization 与 i18n，支持 `ultra`。
- 增加按模型动态 options/default、fallback 和未知值过滤的 regression tests。

## 方案对比

- **方案 A：runtime metadata 优先 + 公共 fallback（采用）**。在线时忠于 CLI，离线或旧 CLI metadata 缺失时仍可用，改动集中在现有 merge boundary。
- **方案 B：删除所有本地 capability fallback**。single source of truth 最纯粹，但 workspace disconnected、旧 CLI 或 degraded response 会直接隐藏 selector，兼容性回退过大。
- **方案 C：逐模型硬编码 capability matrix**。短期可精确展示当前模型，但会随 CLI 发布快速漂移，维护成本和错误率最高。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `codex-model-catalog-coverage`: Codex 模型的 reasoning options/default 必须优先采用 runtime `model/list` metadata，并仅在字段缺失时使用公共 fallback。

## 验收标准

- `gpt-5.6-sol`、`gpt-5.6-terra`、`gpt-5.6-luna` 可根据测试中的不同 runtime metadata 显示不同 options/default。
- runtime 返回非空 capability 时，本地 fallback 不覆盖或裁剪它。
- runtime capability 缺失时，公共 fallback 仍提供稳定的基础选项。
- `ultra` 能通过 frontend 类型、selector normalization 与 send selection 链路。
- focused Vitest、TypeScript typecheck、lint 与 OpenSpec strict validation 通过。

## Impact

- Frontend model catalog merge：`src/features/models/**`
- Composer reasoning selector/types/i18n：`src/features/composer/**`、`src/i18n/locales/**`
- Tests：model hook 与 composer selector/adapter focused suites
- 无新增 dependency，无 backend API breaking change。
