# Provider-Scoped Model Catalog Contract

## Scenario: 新会话供应商绑定驱动模型目录

### 1. Scope / Trigger

- Trigger：修改 Claude Code、Codex 或 Kimi CLI 的新会话 provider binding、模型菜单、`get_engine_models`、provider config resolver 或 Desktop/daemon bridge。
- 目标：已绑定 provider 的 thread 只能读取该 provider 配置模型，并追加 public models；禁止回退到其他 provider 或 global managed config。

### 2. Signatures

```typescript
getEngineModels(
  engineType: EngineType,
  options?: {
    forceRefresh?: boolean;
    providerProfileId?: string | null;
  },
): Promise<EngineModelInfo[]>
```

```rust
#[tauri::command]
pub async fn get_engine_models(
    state: State<'_, AppState>,
    engine_type: EngineType,
    provider_profile_id: Option<String>,
    force_refresh: Option<bool>,
) -> Result<Vec<ModelInfo>, String>
```

```rust
pub(crate) fn get_provider_scoped_engine_models(
    engine_type: EngineType,
    provider_profile_id: Option<&str>,
) -> Result<Option<Vec<ModelInfo>>, String>
```

Response origin field：

```typescript
type EngineModelInfo = {
  id: string;
  model?: string;
  providerProfileId?: string | null;
};
```

### 3. Contracts

- `providerProfileId` omitted/blank：保持 legacy engine-global catalog。
- local/disk sentinel：resolver 返回 `None`，保持对应 CLI 的本地配置行为。
- managed provider：只读取该 provider profile 的 model fields/custom models，不读取其他 provider 或默认 managed config。
- provider models 必须先于 public generated/built-in models 合并；按 runtime `model` identity 稳定去重，provider row 获胜。
- frontend 将 provider-scoped Codex rows 投影到 Composer 时，MUST 仅按 normalized runtime `model` identity 从权威 Codex catalog 补缺 reasoning capability；MUST NOT 覆盖 provider-owned metadata，也不得为 unmatched provider-only model 伪造 capability。
- active provider-bound Codex thread 的非空用户模型名 MUST 直接保留，不得经过 current/global catalog 白名单校验；catalog loading/refresh/absence 不得触发默认模型 repair 回写。blank value 继续走既有 fallback。
- active provider-bound Claude Code thread 采用相同的 non-empty thread model truth contract；catalog loading/refresh/absence 不得重置 model 或 reasoning effort。blank value 继续走既有 fallback。
- public custom model 的 `providerProfileId` 为 `null`；可追加到当前 provider catalog。
- Codex localStorage custom model 若属于其他 `providerProfileId`，Composer 必须过滤。
- Desktop remote forwarding 与 daemon dispatch 必须原样透传 `providerProfileId`。
- frontend cache/dedupe/request identity 必须包含 `engineType + providerProfileId`；旧 scope 晚返回不得覆盖当前模型菜单。
- Shared Picker 根菜单只加载 Provider Profile；具体 Model catalog 必须在用户展开 CLI
  后按 binding lazy load。一个 Profile 失败不得阻塞其他 CLI/Profile。
- local/disk sentinel 可以传给 `getEngineModels` 解析本地配置，但写入 Shared
  `ExecutionTarget` 前必须归一为 `providerProfileId = null`。
- 切换 Target 后当前 Model label 必须从目标 Provider catalog 解析，禁止继续消费旧
  Engine 的 `models` prop。
- missing/invalid managed provider 必须返回可诊断 error；禁止静默回退 global catalog。
- Codex managed provider 的 create-session/model-omitted send fallback 必须读取同一 profile 的 top-level `configToml.model`；仅 disk profile 可读取 workspace/default model。
- Codex provider name 只是 display metadata；名称为 `Kimi` 不得改变 `engine=codex` routing。

### 4. Validation & Error Matrix

| 输入/状态 | 结果 | 禁止行为 |
|---|---|---|
| `providerProfileId` omitted | legacy global/local catalog | 擅自清空已有模型 |
| local/disk sentinel | CLI 本地配置模型 | 当作 managed provider 查询 |
| valid managed provider | provider models + public models，整体去重 | 混入其他 provider models |
| provider model 与 public model 同 runtime id | provider row 保留一次 | public row 覆盖 provider label/origin |
| missing/invalid provider | contextual `Err(String)` | 回退默认 provider |
| provider A 请求晚于 provider B 返回 | UI 保持 provider B catalog | A 覆盖 B |
| daemon mode | 与 Desktop 相同 payload/result contract | 丢失 `providerProfileId` |
| Shared root menu open | 只读取 Profile catalog | 预取所有 Provider models |
| local profile selected | catalog 用 sentinel；Target 用 `null` | 形成第二个 local Binding |
| target catalog partial failure | 仅失败 binding 显示 error | 整个模型菜单不可用 |

### 5. Good/Base/Bad Cases

- Good：thread 绑定 `provider-a`，service 发送 `providerProfileId: "provider-a"`，backend 解析 provider A，合并 public catalog，Composer 过滤 provider B custom rows。
- Base：legacy thread 无 provider binding，继续使用既有 engine-global catalog。
- Bad：只在创建会话时保存 provider binding，但模型刷新仍调用 `getEngineModels(engineType)`。
- Bad：provider lookup 失败后使用 `engineStatuses.models`，导致菜单泄漏默认配置模型。

### 6. Tests Required

- `src/services/tauri.test.ts`：断言 camelCase payload 映射、trim 与 blank omission。
- `src/features/engine/hooks/useEngineController.test.tsx`：断言 scope key、origin metadata、provider A/B stale response guard。
- `src/app-shell-parts/useProviderModelCatalogSync.test.tsx`：断言 Claude/Codex/Kimi thread binding 触发 scoped refresh。
- `src/app-shell-parts/useAppShellComposerModelSection.test.tsx`：断言绑定 Codex provider 后不消费 global model list。
- `src/features/composer/components/ChatInputBox/modelOptions.test.ts`：断言 provider models + public models、过滤其他 provider、runtime id 去重。
- Rust `engine::status::tests`：分别覆盖 Claude/Codex/Kimi provider 优先、public 追加与去重。
- 必跑：`npm run typecheck`、`npm run lint`、`npm run check:runtime-contracts`、`cargo test --manifest-path src-tauri/Cargo.toml engine::status::tests --lib`、`cargo check --manifest-path src-tauri/Cargo.toml --bins`。

### 7. Wrong vs Correct

#### Wrong

```typescript
await getEngineModels(activeEngine);
```

#### Correct

```typescript
await getEngineModels(activeEngine, {
  providerProfileId: activeThread.providerProfileId,
});
```
