## Context

`useModels` 已在 runtime boundary normalize `model/list` 的 `supportedReasoningEfforts` 与 `defaultReasoningEffort`，并通过既有 merge precedence 让 runtime row 覆盖 generated fallback。问题集中在 `codexModelCatalog.ts`：它忽略 generated catalog 的模型差异，为每个 built-in model 注入同一组四档 capability。冷启动和 degraded response 会直接消费这组 metadata，因此呈现错误。

当前本机 Codex 0.144.6 于 2026-08-01 刷新的 `~/.codex/models_cache.json` 提供了逐模型 `supported_reasoning_levels/default_reasoning_level`，与 app-server `model/list` 契约一致，可用于校准 shipped fallback snapshot。

## Goals / Non-Goals

**Goals:**

- 在现有 generated catalog facade 内表达逐模型 fallback capability。
- 保持 runtime metadata precedence、field-level fallback 与 selector ordering 不变。
- 用 focused tests 锁定四个 built-in models 的 degraded behavior 和 runtime override。

**Non-Goals:**

- 不新增 runtime cache reader；用户目录 cache 仅作为本次 catalog 校准证据，不成为产品运行依赖。
- 不修改 hook orchestration、backend、bridge、UI component 或 send contract。
- 不推断 custom/unknown model capability。

## Decisions

### Decision 1: capability metadata 留在 generated catalog row

在 `generatedModelCatalog.json` 的 Codex rows 写入 `supportedReasoningEfforts`，由 `codexModelCatalog.ts` 原样投影；不再维护独立的 `STANDARD_CODEX_REASONING_EFFORTS`。

理由：roster、default 与 fallback capability 同属同一个 versioned snapshot。单一 row 可避免 JSON default 与 TypeScript common array 再次漂移。

Alternative：新增第二个 TypeScript `Record<modelId, capability>`。拒绝，因为它与 generated catalog 重复 model identity，增加同步面。

### Decision 2: 不改变 merge algorithm

继续复用 `mergeModelOption` 与 `mergeModelCatalogSources`。runtime row 的非空 options/default 保持最高优先级；fallback 只在对应字段缺失时生效。

理由：现有 tests 已证明 runtime-first behavior，修复数据即可解决根因，改算法会扩大 selection regression 风险。

### Decision 3: capability fail closed，transport 保留既有 compatibility fallback

只为当前 generated built-in Codex rows 提供已验证映射。custom/unknown model 保持空 capability，不能按 family prefix 或 substring 推断；Native 与 Shared Composer 都继续显示“默认”，frontend selection/send boundary 保持 `selectedEffort = null`。

现有 Codex `send_user_message_core` 会把缺失的显式 effort 转成 `turn/start.reasoning.effort = low`，同时保留 top-level `effort = null` 与 dispatch receipt `reasoningEffort = null`。该 `low` 是 backend transport compatibility fallback，不是 custom model 的已知 capability；本 change 只锁定该既有行为，不修改 app-server protocol 或 backend fallback algorithm。

### Decision 4: 不扩大共享 catalog freshness

`generatedModelCatalog.json` 的 `lastVerifiedAt` 是所有 engines 共用的全局字段。本次只重新验证 Codex reasoning metadata，因此保留既有全局值 `2026-07-27`，不把 Gemini、Grok、Kimi、OpenCode 一并标记为 2026-08-01 已验证。Codex 的 2026-08-01 校准证据仅记录在本 change；per-engine freshness 若需要，应另立 schema change。

## Data Flow

```text
generatedModelCatalog Codex row
  -> getGeneratedModelFallbacks
  -> CODEX_MODEL_CATALOG fallback metadata
  -> mergeCodexSelectableModels
  -> runtime row overrides non-empty fields
  -> selected model reasoningOptions/default

Native custom/unknown model without metadata
  -> Composer shows Default and resolves effort = null
  -> useThreadMessaging native branch
  -> send_user_message effort = null
  -> send_user_message_core
  -> turn/start effort = null + reasoning.effort = low

Shared custom/unknown target without metadata
  -> Shared target reasoning = null
  -> existing Codex owner route
  -> same send_user_message_core compatibility boundary
```

## Risks / Trade-offs

- [Risk] shipped fallback 会随 Codex rollout 变旧。→ Mitigation：runtime 仍为 authority；本 change 记录 Codex 校准日期，但不借用共享 `lastVerifiedAt` 误标其他 engines。
- [Risk] `max/ultra` 在旧 CLI 上不可用。→ Mitigation：连接成功后的 `model/list` 覆盖 fallback；本次映射以当前 shipped Codex catalog 为版本化 degraded baseline。
- [Risk] 手改 JSON 与生成流程不一致。→ Mitigation：只扩展现有 schema 字段，补 focused tests；不引入第二份 map。
- [Risk] 将 backend `low` fallback 误解为 custom model capability。→ Mitigation：spec 明确区分 UI capability metadata 与 transport compatibility，并分别锁定 frontend `null`、backend wire `low`。

## Migration Plan

无 storage 或 API migration。部署后 cold startup 立即获得正确 fallback；runtime hydration 后行为维持不变。回滚时原子回退 generated rows、facade 和 tests。

## Open Questions

无。
