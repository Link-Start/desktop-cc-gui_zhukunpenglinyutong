## Context

Phase 6B 已将跨 feature tool semantics 移到 neutral owner，但 `GenericToolBlock` 内仍混合
pure projection 与三类 specialized rendering。Roadmap 要求先完成 leaf decomposition，再迁移
shared Markdown 和核心 messages controllers，以降低后续变更的耦合面。

## Decisions

### Decision: presentation model 是唯一 variant normalization owner

新增 `buildGenericToolPresentation(item)`，返回 normalized tool/status/summary、parsed args、
file changes、image candidate、ExitPlan content、raw output 与 hydration weight。Builder 保持 pure，
不读取 translation context，也不创建 React elements。

### Decision: specialized components 只接收 projected data

`ExitPlanToolContent`、`FileChangeToolContent`、`ImageViewToolContent` 接收 builder 输出和必要的
variant-local callbacks。它们不重新解析 `ToolConversationItem`，避免 parser/presentation 双 owner。

### Decision: common interaction shell 留在 GenericToolBlock

marker、标题/status、expand/collapse、canonical copy、heavy hydration gate 与 variant dispatch 继续由
`GenericToolBlock` 组合。这样拆分不改变 public props、state ownership 或 DOM hierarchy。

### Decision: mechanical extraction first

先用现有 regression tests 锁定 variants，再机械移动 pure helpers/JSX；不在本 change 修改文案、
CSS class、icon、keyboard behavior 或 translation keys。

## Risks / Mitigations

- projection identity drift：builder 对同一 item 只计算一次，组件消费同一 model。
- copy/expand bubbling drift：保留现有 stopPropagation 与 state owner，并用 focused tests 验证。
- heavy output eager rendering：hydration weight 与 delayed reveal contract 保持原阈值和触发条件。
- file/image fallback drift：先为 pure builder 补 model-level cases，再迁移 JSX。

## Verification

运行 GenericToolBlock focused tests、新增 pure builder tests、toolBlocks/messages suites、typecheck、
targeted ESLint、build、runtime/bundle/boundary gates、large-file qualifier 与 OpenSpec strict validation。
