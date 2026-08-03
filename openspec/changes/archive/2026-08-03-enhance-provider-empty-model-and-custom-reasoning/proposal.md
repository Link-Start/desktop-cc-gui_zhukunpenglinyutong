# 新供应商空模型兜底与自定义模型思考强度默认档

## Why

- 用户新增供应商后若未配置自定义模型，模型选择器对应渠道的模型列表可能为空，且没有任何指引，体验不友好。
- 用户选择自定义模型后，Codex 思考强度经常丢失：自定义模型无 reasoning metadata 时 `reasoningOptions` 为空，`getEffectiveSelectedEffort` 把 effort 归零；跨 engine / provider 切换 target 时 `buildProviderExecutionTarget` 也会把 reasoning 置为 `null`。
- 目标：渠道模型为空时读取对应供应商配置的默认模型作为兜底 row；仍为空时给出 UI 提示引导用户去「自定义模型」添加；用户管理的自定义模型获得默认主流思考强度档位（low/medium/high/xhigh，默认 medium），选择自定义模型时不再丢失 effort。

## 目标与边界

- 保持现有 UI 外观与 UX 交互不变，只增强空态文案与数据兜底。
- 自定义模型默认档位仅作用于用户管理的自定义模型（`source: custom`，即「自定义模型」管理器写入 localStorage 的条目）；不为 CLI runtime 发现的 unknown model 伪造 capability（延续 `fix-codex-model-reasoning-fallback-mapping` 决策）。
- 保持 send payload、Rust bridge 与 backend validation 契约不变；Claude 自定义模型沿用既有 `low..max` 常驻档位，不做额外注入。
- 新增供应商后无需重启即可在选择器看到新渠道（修复 module 级 catalog 缓存不失效问题）。

## 非目标

- 不修改 Composer reasoning selector 的 UI、i18n 结构或已支持 effort 类型。
- 不新增 dependency；不为 Codex 前端解析 TOML（`configToml.model` 由 backend resolver 已覆盖）。
- 不改变非 Codex engine 的 reasoning 契约。
- 不修改 Shared Session target validation 或 V2 send 的 `UnlistedRuntimeModelPolicy`。

## What Changes

1. 新增 `src/features/models/customModelReasoning.ts`：自定义模型默认档位常量与解析 helper（`CUSTOM_MODEL_REASONING_EFFORTS`、`CUSTOM_MODEL_DEFAULT_REASONING_EFFORT`、`resolveCustomModelDefaultReasoningEffort`）。
2. `src/features/models/hooks/useModels.ts`：`readCustomCodexModelOptions` 为 localStorage 自定义 Codex 模型附加默认 reasoning metadata；`enrichScopedCodexReasoningMetadata` 的 runtime/authoritative 优先语义不变。
3. `src/features/composer/components/ChatInputBox/hooks/useProviderTargetCatalogOwners.ts`：
   - 导出 `invalidateProviderTargetCatalogForRuntime()` / `PROVIDER_TARGET_CATALOG_INVALIDATED_EVENT`，供应商 CRUD 后失效模块级 catalog 缓存并通知挂载中的 picker 刷新。
   - `ensureModels` 对 managed profile 返回空数组时，回退读取该供应商配置的默认模型（Claude `ANTHROPIC_MODEL`/`ANTHROPIC_DEFAULT_*`，Kimi/Grok `model`，OpenCode `models[0]`）作为兜底 row。
4. `src/features/vendors/hooks/use{Provider,CodexProvider,KimiProvider,GrokProvider,OpenCodeProvider}Management.ts`：在 add/update/delete/switch/settings-json-saved 成功路径调用 `notifyProviderTargetCatalogChanged()`；cc-switch import 成功路径同此。
5. `src/features/composer/components/ChatInputBox/selectors/ModelSelect.tsx`：
   - 渠道空模型 disabled row 文案升级为两行引导（指向「添加模型」自定义入口），不改变布局。
   - 选择/切换渠道选中自定义 Codex 模型且 target reasoning 为空时，播种默认 effort `medium`（通过 `buildProviderExecutionTarget` 新增可选参）。
6. i18n（zh/en）+ focused 单测。

## 方案对比

- **方案 A：前端空 catalog 回退读取供应商默认模型 + 空态引导（采用）**。直接满足「读取供应商配置默认模型」；backend 已输出默认模型时天然无感，仅兜底空结果；空态引导覆盖真正无默认模型的场景。
- **方案 B：仅改 backend 保证 catalog 永不空**。Kimi/Grok/OpenCode 已按配置输出默认模型，真正空场景来自 fetch 失败/RPC fallback，backend 无法兜底；仍需前端引导，故不充分。
- **方案 C：只在空态显示引导、不读默认模型**。不满足用户「读取供应商配置默认模型」的诉求，弃用。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `provider-model-catalog-refresh`：Provider CRUD 后 catalog 缓存失效；managed profile 空 catalog 回退读取配置默认模型；空模型渠道显示自定义模型引导。
- `codex-model-catalog-coverage`：用户管理自定义 Codex 模型暴露默认主流 reasoning 档位（覆盖先前“不为 custom model 猜测 capability”中用户管理自定义模型子集的边界）。

## 验收标准

- 新增/编辑/删除/切换供应商后，模型选择器无需重启即可看到最新渠道。
- 渠道模型为空且供应商配置含默认模型 → 默认模型 row 可见且可选中。
- 渠道模型为空且无默认模型 → 显示引导文案，并保留下方「添加模型」入口。
- 自定义 Codex 模型在 reasoning selector 中展示 low/medium/high/xhigh，默认 medium；选择自定义模型后 `target.reasoning` 不再丢失为 `null`（用户已选 effort 不被覆盖）。
- focused Vitest、`npm run typecheck`、target ESLint、`openspec validate --strict` 通过。

## Impact

- Frontend：`src/features/models/customModelReasoning.ts`（新增）、`src/features/models/hooks/useModels.ts`、`src/features/composer/components/ChatInputBox/hooks/useProviderTargetCatalogOwners.ts`、`src/features/composer/components/ChatInputBox/selectors/ModelSelect.tsx`、五个 vendor management hooks、`src/features/vendors/components/VendorSettingsPanel.tsx`（cc-switch import）、i18n zh/en models locale。
- Focused tests：`useProviderTargetCatalogOwners.test.tsx`、`ModelSelect.test.tsx`、`useModels.test.tsx`。
- 无 API、storage schema、backend、dependency 或 migration 影响。
