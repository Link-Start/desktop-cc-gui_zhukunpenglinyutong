## Context

Codex app-server `model/list` 已按模型返回 `supportedReasoningEfforts` 与 `defaultReasoningEffort`。Frontend `useModels` 能解析这些字段，但 built-in catalog 同时携带统一四档 metadata；当 runtime 字段为空或 catalog 被用于 degraded fallback 时，Sol、Terra、Luna 等模型会显示相同能力。Composer 的封闭 union 还会过滤新值 `ultra`。

## Goals / Non-Goals

**Goals:**

- 将 runtime model metadata 作为每个模型的 capability truth。
- 仅对 runtime 缺失的字段使用共享 fallback。
- 在现有 typed selector 中加入当前已知的 `ultra`。
- 保持 selection repair、custom models 与 app-server transport 不变。

**Non-Goals:**

- 不接受任意未知字符串进入发送链。
- 不新增 backend command 或 dependency。
- 不为每个模型复制一份静态 capability table。

## Decisions

### Decision 1: 在 model merge boundary 执行 runtime-first 的逐字段合并

Capability merge 按 `built-in fallback → custom model → runtime baseModels` 执行，后进入的非空 reasoning 字段覆盖前值，确保 runtime 永远拥有最终优先级。最终 selector 顺序通过独立的 ordering pass 按 `runtime → custom → built-in` 重建，因此 capability precedence 不再依赖 UI display order。这复用当前 `mergeModelOption` boundary，避免在 selector、state repair 和 send path 重复判断来源。

Alternative：完全移除 fallback。拒绝，因为 disconnected/旧 CLI 的可用性会回退。

### Decision 2: 公共 fallback 只表达基础兼容能力

内置模型可以共享基础 effort options/default，但其语义明确是 runtime metadata 缺失时的 fallback。模型专属差异不写死在 catalog，由 CLI 动态覆盖。

Alternative：维护逐模型静态矩阵。拒绝，因为 CLI model rollout 更快，静态矩阵必然漂移。

### Decision 3: `ultra` 作为已知 typed effort 显式接入

扩展 `ReasoningEffort`、`REASONING_LEVELS`、normalization 与所有 locale key。未知未来值仍 fail closed，避免把未审计 capability 透传到 runtime。

### Decision 4: runtime connected 后重拉当前 workspace model catalog

冷启动的首次 `model/list` 可能早于 Codex app-server ready，此时 degraded empty response 只能用于暂时展示公共 fallback。现有 `codex/connected` event 是 runtime ready 的权威信号；事件到达时，当前 workspace MUST 复用 `useModels.refreshModels()` 再拉一次动态 metadata。非当前 workspace 的连接事件不得刷新当前 selector，避免跨 workspace catalog 污染。

## Data Flow

```text
app-server model/list
  -> useModels response normalization
  -> runtime-first merge with built-in fallback
  -> selected model reasoningOptions/default
  -> typed Composer selector
  -> existing effort send payload

codex/connected (active workspace)
  -> refreshModels()
  -> replace degraded fallback with runtime model metadata
```

## Risks / Trade-offs

- [Risk] runtime 返回未知 effort 时 typed UI 会隐藏该值。→ Mitigation：为已知 `ultra` 建立测试；未来新增值仍需显式接入，保持 fail-closed。
- [Risk] default value 不在 options 中会导致 selection repair 异常。→ Mitigation：测试 runtime options/default 组合，并复用现有合法性收敛逻辑。
- [Risk] fallback 掩盖 runtime degraded 状态。→ Mitigation：fallback 只补缺失 capability，不改写 runtime 已返回的字段与 source。
- [Risk] startup empty response 被标记为已尝试，runtime ready 后不再 hydration。→ Mitigation：以 `codex/connected` 为一次明确的 retry trigger，仅刷新 active workspace。

## Migration Plan

无需数据迁移。发布后重新执行 `model/list` 即可获得按模型 capability；旧 CLI 或 disconnected workspace 继续使用公共 fallback。回滚时可原子回退 frontend merge/type/i18n 改动，不影响持久化数据和 backend protocol。

## Open Questions

无。
