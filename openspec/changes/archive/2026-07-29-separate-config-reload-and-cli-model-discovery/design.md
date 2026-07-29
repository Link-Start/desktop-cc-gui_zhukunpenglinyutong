## Context

模型选择器当前存在两个 catalog owner：`useEngineController` 维护普通 Composer 的 engine catalog，`useSharedProviderTargetCatalog` 维护 Native/Shared Provider Profile 的 lazy cache。现有 refresh action 只触发前者，因此 backend 即使返回新结果，Shared/Native picker 仍可能展示旧 cache。

同时，现有 `get_engine_models` 语义是读取 configured/provider catalog；Codex app-server 的 `model/list` 才是实际 CLI runtime discovery。Claude Code、Kimi 当前没有已验证的 model-list protocol。本设计必须保留这一区分，不引入 HTTP，也不解析 CLI help。

## Goals / Non-Goals

**Goals:**

- `Reload Config` 与 `Discover Models` 成为两个独立、Provider-scoped 的动作。
- Native Composer 与 Shared Session 共用 `useSharedProviderTargetCatalog` 的 binding cache。
- Codex discovery 通过对应 `workspaceId + providerProfileId` 的 Codex app-server session 执行 `model/list`。
- Custom/configured/discovered/fallback 分源更新并稳定合并；失败保留 last-good。
- Desktop 与 daemon 保持相同 command payload/result contract；daemon 仅对其当前支持的
  disk runtime 执行 discovery，managed Provider 必须显式报不支持，禁止回退 disk。

**Non-Goals:**

- 不新增或复用任何 HTTP model endpoint。
- 不为 Claude/Kimi 伪造 CLI discovery。
- 不自动持久化 discovery 结果。
- 不改变 Shared Session Target/send schema。
- 不统一 Kanban、Project Map 等其他 catalog consumer。

## Decisions

### Decision 1：Provider Profile catalog hook 是当前菜单的 refresh owner

`useSharedProviderTargetCatalog` 增加：

```ts
reloadConfig(engine, providerProfileId): Promise<void>
discoverModels(engine, providerProfileId): Promise<void>
```

两个动作都以 `engine + providerProfileId` 为 request/cache key，并直接更新 `loadedModels`。`ModelSelect` 传出当前展开 Profile 的完整 action scope，普通 Composer 与 Shared Session 不再从 active thread 猜目标。

替代方案是继续由 AppShell engine controller 刷新，再等待 `currentModels` 下传。该方案无法刷新 Shared Session 正在浏览但尚未选择的 Provider B，因此拒绝。

### Decision 2：Config 与 discovery 使用独立 source slice

每个 binding 保存：

```ts
type ProviderCatalogSlices = {
  configured: ModelInfo[];
  discovered: ModelInfo[];
  lastGood: ModelInfo[];
};
```

最终列表按以下顺序合并并以 normalized runtime `model` 去重：

1. Provider/User Custom
2. Configured/Pinned
3. CLI-discovered
4. Last-good
5. Built-in/Generated fallback

Config reload 只替换 configured slice；CLI discovery 只替换 discovered slice。失败不得清空任何 slice。

替代方案是任一动作覆盖整份 catalog。该方案会让 discovery 删除 custom models，或让 config reload 删除 runtime metadata，因此拒绝。

### Decision 3：CLI discovery 是显式 capability

当前 capability matrix：

- Codex：支持，通过 app-server `model/list`。
- Claude：不支持；只显示 `Reload Config`。
- Kimi：不支持；只显示 `Reload Config`。

`Discover Models` 只有 capability 为 true 时才渲染。禁止用空数组或 fallback 冒充 discovery success。

### Decision 4：Codex discovery 显式获取目标 Provider runtime

新增 provider-scoped discovery command，输入：

```ts
discoverCodexModels(workspaceId, providerProfileId): Promise<ModelListResponse>
```

Desktop：

1. normalize local sentinel；
2. `ensure_codex_session_for_provider`；
3. 使用 `session_key_for_provider(workspaceId, providerProfileId)`；
4. 向该 session 发送 `model/list`。

daemon 保持相同 command routing；disk profile 复用 daemon Codex session，当前不支持
managed Provider runtime 时返回明确错误，禁止静默改用 disk session。普通 passive
`model_list(workspaceId)` 保持原语义，不借刷新按钮隐式改变 startup acquisition
contract。

### Decision 5：错误必须绑定到 action + binding

loading/error state key 包含 `action + engine + providerProfileId`。同一 binding 的重复请求串行化；不同 binding 可独立执行。失败更新 profile error 并 reject 给按钮层，但保留 last-good catalog 与当前 selection。

## Risks / Trade-offs

- [Risk] Codex discovery 会启动目标 Provider app-server，成本高于读配置。→ 仅显式点击触发，不预取、不轮询，并复用已有 session。
- [Risk] runtime `model/list` 与 configured custom model metadata 不一致。→ configured/custom 优先，discovered 只补充。
- [Risk] Provider A 的慢响应覆盖 B。→ request key 与 state write 都锁定完整 binding key。
- [Risk] 当前选择不再出现在新 catalog。→ 保留 selection，不自动切换；发送前继续使用既有 target validation。
- [Risk] 工作区没有可启动 Codex runtime。→ 显示 binding-scoped error，不回退其他 Provider。

## Migration Plan

1. 增加 OpenSpec delta 与 Trellis catalog contract。
2. 增加 provider-scoped Codex discovery bridge，保持 legacy `model_list` 不变。
3. 扩展 catalog hook 的 slices/actions/capability。
4. `ModelSelect` 在当前展开 Profile 上呈现双 action；普通与 Shared 接入同一 actions。
5. 跑 focused frontend/service/Rust tests、typecheck、lint、runtime contract。

Rollback：移除 discovery command/action 与 discovered slice，恢复单一 config reload；无 persisted schema 或数据迁移。

## Open Questions

无。用户已确认：Discovery 仅走 CLI，禁止 HTTP；只执行增量测试。
