# 设计：新供应商空模型兜底与自定义模型思考强度默认档

## 1. Catalog 缓存失效（新供应商立即可见）

### 现状问题

`useProviderTargetCatalogOwners.ts` 的 `profileCatalogCache` / `modelCatalogCache` / `discoveredModelCatalogCache` / request maps 是模块级缓存，仅 `resetProviderTargetCatalogForTests` 清理；生产路径没有任何失效入口。新增/编辑/删除供应商后，选择器沿用旧 profile list 与旧 model catalog，必须重启才可见。

### 方案

- 新增导出：
  - `PROVIDER_TARGET_CATALOG_INVALIDATED_EVENT = "ccgui:provider-target-catalog-invalidated"`
  - `invalidateProviderTargetCatalogForRuntime()`：清空四个模块级缓存 + request maps（与 test reset 等价，但不暴露给 test-only 命名）。
  - `notifyProviderTargetCatalogChanged()`：先 `invalidateProviderTargetCatalogForRuntime()`，再 `window.dispatchEvent(PROVIDER_TARGET_CATALOG_INVALIDATED_EVENT)`。
- `useProviderTargetCatalogOwner` 挂载后监听该事件：
  - 重置本地 `profiles`（→ `DEFAULT_PROFILES`）、`loadedModels`（→ `initialLoadedModels(mode)`，缓存已清空故为空）、`loadingBindings`、`modelErrors`、`catalogActions`、`authoritativeRefreshCompletedBindingsRef`。
  - 调用 `ensureProfiles()` 重新拉取最新 provider list。
- 五个 vendor management hook 在 add/update/delete/switch/settings-json-saved 成功路径调用 `notifyProviderTargetCatalogChanged()`；`VendorSettingsPanel` 的 cc-switch import 成功回调同此。

### 边界

- 事件只在 hook 挂载时生效；未挂载时模块缓存已被直接清空，下一次挂载读取到最新数据。
- 不改变既有 picker 交互；仅在供应商数据变化后刷新列表。

## 2. 空模型兜底（读取供应商配置默认模型）

### 现状问题

managed profile 的 catalog 由 backend `get_provider_scoped_engine_models` 输出：
- Claude：builtin + env overrides，理论上不空。
- Codex：customModels + `configToml.model`，backend 已覆盖。
- Kimi/Grok：`provider.model` 存在时输出单 row。
- OpenCode：`provider.models[0]` 存在时输出 rows。

真正返回空数组的场景：RPC fallback mode（非 codex 返回 `[]`）、provider 配置无 model 字段、或 fetch 成功但 catalog 为空。此时前端无兜底。

### 方案

`ensureModels` 中 `getEngineModels` 返回 `[]` 且目标为 managed profile（非 local sentinel）时，调用 `resolveProviderConfiguredDefaultModel(engine, providerProfileId)`：

| engine | 来源 | 取值 |
|---|---|---|
| claude | `getClaudeProviders().find(id)` | `env.ANTHROPIC_MODEL` 或 `ANTHROPIC_DEFAULT_FABLE/SONNET/OPUS/HAIKU` 首个非空 |
| kimi | `getKimiProviders().find(id)` | `model` |
| grok | `getGrokProviders().find(id)` | `model` |
| opencode | `getOpenCodeProviders().find(id)` | `models[0]` |
| codex | —（backend 已覆盖 `configToml.model`） | 不解析 TOML |

兜底 row：`{ id: model, model, label: model, source: "provider-config", providerProfileId }`，仅写入 hook 本地 `loadedModels`，**不写入模块级 `modelCatalogCache`**（避免污染后续真实 catalog 重试）。仍为空则保持空，走 UI 引导。

## 3. 空态 UI 引导

`ModelSelect` 子菜单空模型 disabled row（现 `models.noModels`）升级为两行引导：
- 标题：`models.emptyChannelModelsTitle`（该供应商暂无可用模型）
- 副文案：`models.emptyChannelModelsHint`（可点击下方「添加模型」，在自定义模型中添加后使用）

保持 `DropdownMenuItem disabled` 外观与布局，底部「添加模型」按钮沿用现有 `onAddModel`，不新增入口。加载中 / error 状态路径不变。

## 4. 自定义模型思考强度默认档

### 现状问题

- localStorage 自定义 Codex 模型 `source: custom`，无 `supportedReasoningEfforts`；`getReasoningOptionsForModel` 返回空 → `getEffectiveSelectedEffort` 对 codex 归零 → 思考强度丢失。
- 跨 engine/profile 切换 target 时 `buildProviderExecutionTarget` 把 reasoning 置 `null`。

### 方案

- 新增 `src/features/models/customModelReasoning.ts`：
  - `CUSTOM_MODEL_REASONING_EFFORTS = ["low", "medium", "high", "xhigh"]`
  - `CUSTOM_MODEL_DEFAULT_REASONING_EFFORT = "medium"`
  - `CUSTOM_MODEL_SUPPORTED_REASONING_OPTIONS`（含 description）
  - `resolveCustomModelDefaultReasoningEffort(engine, model)`：仅 `engine === "codex" && model?.source === "custom"` 时返回默认档，否则 `null`。
- `useModels.readCustomCodexModelOptions`：自定义模型附加 `supportedReasoningEfforts` + `defaultReasoningEffort`。`enrichScopedCodexReasoningMetadata` 的 identity 匹配覆盖语义不变（匹配 authoritative 则覆盖，未匹配保留默认档）。
- `ModelSelect`：
  - `handleTargetModelSelect` / `handleChannelSwitch`：选中模型为自定义 Codex 模型时向 `buildProviderExecutionTarget` 传 `defaultReasoningEffort = "medium"`。
  - `buildProviderExecutionTarget` 新增可选第 9 参 `defaultReasoningEffort?: string | null`：仅当计算出的 `reasoning` 为 `null` 时播种；用户已选 effort 不被覆盖。
- 既有 `ModelSelect.test.tsx` 中 `buildProviderExecutionTarget` 无新参的调用保持原行为（不播种）。

## 5. 测试

- `useProviderTargetCatalogOwners.test.tsx`：
  - managed profile 空结果 → 兜底默认模型 row 写入 loadedModels。
  - `notifyProviderTargetCatalogChanged` → 本地状态重置 + 重新 ensureProfiles。
- `ModelSelect.test.tsx`：
  - 空模型渠道显示引导文案。
  - 自定义 Codex 模型选择 → `executionTarget.reasoning = { effort: "medium" }`。
  - 用户已选 effort（same engine+profile）不被覆盖。
- `useModels.test.tsx`：localStorage 自定义 Codex 模型获得默认档位（`reasoningOptions` 含 low/medium/high/xhigh）。
