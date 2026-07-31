## Context

Foundation Design 将 `ExecutionTarget` 定义为 Engine + Provider + Model + Reasoning，并要求
Model catalog 受 Provider scope 约束。但当前 frontend `ExecutionTarget.model` 同时承担 UI
option id 与 runtime model 两种语义：

```text
ModelInfo.id=settings-reasoning
ModelInfo.model=deepseek-v4-pro
        |
        v
ModelSelect -> ExecutionTarget.model=settings-reasoning
        |
        v
Native continuation -> Claude --model settings-reasoning
```

Claude target JSONL 随后同时包含完整 bootstrap user entry 和结构化 API error assistant
entry。当前 recovery 只检查前者，因此会把明确失败降级成 `acceptance-ambiguous`，甚至在 retry
时转成 `ready`。

约束：

- 来源 Session 与现有 operation identity 不可修改或重建。
- 保留现有未提交的 `CanonicalProviderProfileSource` 变更。
- Claude custom model 仍遵守 shape-only passthrough，不引入 official allowlist。
- 不新增依赖，不跑全量测试。

## Goals / Non-Goals

**Goals:**

- 明确 catalog entry identity 与 runtime model identity。
- 在 frontend selection boundary 和 backend target boundary 双重闭环。
- 将 target history 的结构化 API rejection 定义为强负 evidence。
- retry 继续复用同一 target identity，但显式拒绝永不转成成功。

**Non-Goals:**

- 不重构全部 Shared Session target schema。
- 不替换 Claude session runtime 或 history reader。
- 不自动修复已生成的错误 target Session。
- 不根据 Provider 的官方模型命名规则拦截用户 custom model。

## Decisions

### D1. `model` 保持 runtime 语义，新增可选 catalog identity

`ExecutionTarget` 与 `ProviderContinuationTargetInput` 增加可选
`modelCatalogEntryId`；frontend picker：

1. 用 `ModelInfo.id` 做菜单 key、选中状态和可读诊断；
2. 用非空 `ModelInfo.model` 作为 `ExecutionTarget.model`；
3. legacy entry 没有 `model` 时显式 fallback 到 `id`；
4. destination 同时冻结 `modelCatalogEntryId` 和 runtime `model`。

选择该方案而不是只改 `model.id -> model.model`，因为 operation 必须保留“用户选了哪个
catalog entry”的审计身份，且 backend 需要验证两者关系。

### D2. backend 复用 provider-scoped catalog 做 trust-boundary validation

Claude continuation 在写入 `creating`、生成 target identity 前调用既有
`get_provider_scoped_engine_models`：

- 有 `modelCatalogEntryId`：必须找到该 entry，且 runtime `model` 与 entry.model 一致。
- 无 catalog id：若传入值命中一个 `id != model` 的 catalog entry id，则返回
  `invalid-target-model`，防止 legacy/非 UI caller 重放当前 bug。
- 传入值匹配 catalog runtime model：允许。
- 未命中 catalog 的非空值：按既有 Claude custom model shape-only contract passthrough。
- 未指定 model：保持 CLI/provider 默认模型语义。

validation 在任何 target side effect 前执行。拒绝时 operation 仍停留在可安全重试的
prepared path。

### D3. recovery evidence 使用三态而非 boolean

将 Claude JSONL probe 从 `bool` 改为：

```text
Missing
Accepted
Rejected { status, message }
```

解析器只在找到当前 `package_marker + MOSSX_NATIVE_CONTEXT_V1` bootstrap user entry 后，
解释其后的 assistant entry：

- `isApiErrorMessage=true` 或结构化 `apiErrorStatus`：`Rejected`
- exact acceptance marker：`Accepted`
- 只有 bootstrap user entry、尚无 assistant terminal：保留现有 durable weak acceptance
  兼容，但前提是没有后续强负 evidence

遍历完成后，`Rejected` 优先级高于所有正 evidence。这样来源 Context 中提及旧
`API Error` 不会污染判断。

### D4. 首次执行错误与 retry 共用同一 probe

Claude runtime 返回 `Err` 后，立即对已知 target identity 做 bounded history probe：

- `Rejected`：operation 写 `target-provider-rejected`，返回结构化 rejection detail。
- `Missing`：保持 `acceptance-ambiguous`，因为 process error 不能证明 target 未创建。
- `Accepted`：继续 metadata commit；避免 runtime 返回噪声 warning 时制造假失败。

retry 同样调用该 probe，不创建第二个 Session。

### D5. 错误优先级

错误选择顺序：

```text
structured Provider/API rejection
> durable accepted evidence
> runtime process error
> stderr warning / connector warning
```

UI 继续使用已有 recovery dialog；本变更不新增并行错误 UI。

## Risks / Trade-offs

- [Risk] 某些 Claude 版本不写 `isApiErrorMessage` → 同时识别
  `apiErrorStatus`，但不使用宽泛的全文件 substring。
- [Risk] legacy caller 只传 custom model，catalog 无法证明 → 保留 shape-only passthrough，
  仅拒绝明确命中 `id != model` 的 UI id。
- [Risk] bootstrap user entry 已落盘但 assistant 尚未落盘 → bounded probe 返回现有弱成功
  兼容；后续显式 rejection 在 retry 时仍覆盖它。
- [Trade-off] 暂不把完整 `ModelSelectionSnapshot` 推广到所有 Shared turns；本次只新增
  continuation 所需的 additive catalog id，避免与在途 Shared rollout 大范围冲突。

## Migration Plan

1. additive 扩展 TypeScript/Rust DTO，旧 payload 继续可反序列化。
2. 更新 picker target builder 和 focused tests。
3. 增加 backend validation 与三态 evidence parser。
4. 更新 Trellis executable contract 与 OpenSpec delta。
5. 运行 focused Vitest、focused Rust tests、typecheck、runtime contracts、strict validate。

回滚：frontend 可回滚为不发送 `modelCatalogEntryId`；backend additive field 向后兼容。
不得回滚三态 rejection precedence 后继续使用当前错误 operation 的 retry。

## Open Questions

无。完整 `ModelSelectionSnapshot` 向 Shared 全链推广留给独立 change，本次不扩 scope。
