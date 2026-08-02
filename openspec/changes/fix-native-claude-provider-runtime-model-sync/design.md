# Design: fix-native-claude-provider-runtime-model-sync

## Context

证据（用户截图 2026-08-02）：

- Native Claude Code + 渠道 DeepSeek
- 选择器四行主标题均为 `deepseek-v4-pro`，副标题 Fable/Opus/Sonnet/Haiku
- API：`passed k3`（Kimi 残留）

架构现状：

```text
Claude builtin tier catalog (stable ids)
  → apply_claude_model_overrides(provider env ANTHROPIC_* slots)
  → UI label (catalog name OR localStorage mapping)
  → selection stores catalog entry id
  → send resolves model.model ?? selectedModelId
  → claude --model <runtime>
  → process env + --settings private override
```

断点：label 可来自 mapping；send 可来自脏 catalog / id 冒充；env 可泄漏父进程 k3。

## Goals / Non-Goals

见 proposal。核心：**单源 runtime** + **env 隔离** + **repair**。

## Decisions

### D1. Send-time re-resolve（权威）

发送 Claude managed turn 时：

```text
1. profileId = thread.providerProfileId（L2 binding）
2. entryId = composer selectedModelId / nativeAtomicSelection.catalogEntryId
3. runtime = currentCatalog.find(entryId)?.model
         ?? profileEnv.ANTHROPIC_MODEL
         ?? nativeAtomicSelection.model（仅当其 ∈ catalog runtimes）
4. if runtime invalid for profile → repair or fail-closed toast
5. modelForSend = runtime
```

禁止：`modelForSend = selectedModelId` 当 id 是 `claude-*` 档位且 catalog 有 mapping 时直接上送档位 id（除非该字符串本身即合法 runtime）。

### D2. Process env 清键

在 `build_command_with_profile` 注入 provider_env 前：

```rust
for key in CLAUDE_PROVIDER_ROUTING_ENV_KEYS {
    cmd.env_remove(key);
}
if let Some(provider_env) = provider_env {
    cmd.envs(provider_env);
}
```

与 private `--settings` 中 `or_insert("")` 互补：进程级与 settings 级双保险。

### D3. Fail-closed validation

合法集合 =  
`{ m.model for m in provider_scoped_catalog }` ∪ non-empty slots from  
`ANTHROPIC_MODEL` / `ANTHROPIC_DEFAULT_*` on that profile.

DeepSeek 可额外文档化 allowlist（`deepseek-v4-pro` | `deepseek-v4-flash`）作为 provider 元数据或启发式；通用路径以 catalog∪env 为准。

### D4. Selection repair on activate / catalog refresh

触发点：

- `activateEngineProviderProfile` 成功后
- `useProviderModelCatalogSync` catalog 刷新后
- Native 同 profile 点选后 catalog 返回

规则：

```text
if current selection runtime ∉ legal set for active/thread profile:
  next = catalog.default || env.ANTHROPIC_MODEL || first legal
  persist composer selection (catalog entry id + effort)
  clear stale nativeAtomicSelection or rewrite to match
```

### D5. Label / send 单源

新增 `resolveClaudeRuntimeModelForDisplayAndSend(model, mapping?, profileScoped: boolean)`：

- **provider-scoped catalog 行**（有 `providerProfileId`）：权威 = `model.model`
- **非 scoped**：可用 mapping 解析 **仅当** 解析结果与即将 send 的逻辑一致；推荐统一：send 与 label 都走 catalog 刷新后的 `model.model`

localStorage mapping 继续服务：settings 页编辑、icon brand、activate 时 `syncModelMappingFromProviderEnv` 写入。

### D6. nativeSessionTarget 投影

```ts
const entry = models.find(m => m.id === propModelId)
const runtimeModel =
  nativeAtomicSelection?.model
  ?? entry?.model
  ?? null  // 不再 fallback 到 propModelId 档位 id
```

无合法 runtime 时 target 不完整，提交门闸已有 `sharedTargetResolved` 类比可扩展。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 过严校验拦截 freeform 自定义模型 | freeform 仅当 profile 明确 Allow 或 env 含该名；与既有 UnlistedRuntimeModelPolicy 对齐 |
| repair 打断用户刻意选的短名 | 仅当 runtime 不在 legal set；k3 on DeepSeek 属非法 |
| env_remove 影响本地 disk profile | local profile 不走 managed provider_env 注入路径，行为不变 |

## Migration / 兼容

- 已有 thread binding 不变
- 用户只需重新发送；脏 selection 自动 repair
- 无 DB migration

## Verification Plan

- `cargo test`：claude env_remove 后无父进程 k3；--model 使用 runtime
- vitest：send re-resolve；repair on catalog；nativeSessionTarget；label 与 runtime 一致
- 手工：DeepSeek 渠道发消息不再 400；Kimi→DeepSeek 切换后首发正确
