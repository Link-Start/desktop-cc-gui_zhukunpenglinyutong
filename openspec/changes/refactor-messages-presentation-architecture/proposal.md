## Why

`src/features/messages` 的核心展示链路已因 multi-engine streaming、long-history virtualization、rich rows、bottom-follow 与 runtime recovery 累积为三个 2,000 行以上的大组件，并暴露约 48/87 个扁平 props。当前行为已有大量 regression contract 保护，现在适合在不改变任何用户行为的前提下重建高内聚、低耦合的内部边界，降低后续性能修复与功能迭代的回归风险。

## What Changes

- 将核心展示架构按 `orchestration / timeline / rows` 领域重新落位，避免大量 helper 与 component 同级堆叠。
- 保留 `components/Messages.tsx`、`MessagesTimeline.tsx`、`MessagesRows.tsx` 作为稳定 public entry；领域子模块下沉，但不通过整体搬家规避 large-file ratchet。
- 以 `TimelineSnapshotModel`、`TimelineLiveModel`、`TimelineRuntimeModel`、`TimelineNavigationModel`、`TimelineInteractionModel`、`TimelinePresentationModel`、`TimelineSlotsModel` 收敛 timeline 接口。
- 将 stable snapshot 与 high-frequency live tail 严格分轨，禁止重构重新引入 per-delta parent derivation。
- 分阶段迁移 pure helpers、timeline rendering、virtualization governance、row components 与 Messages controller logic。
- 使用现有 focused tests、full frontend gates 与 OpenSpec strict validation 证明行为等价。
- 不引入 breaking change，不新增 dependency，不修改 CSS、i18n、DOM contract、Markdown 或 toolBlocks 行为。

## Capabilities

### New Capabilities

- `messages-presentation-architecture`: 规定 messages presentation subsystem 的内部职责边界、typed view models、单向依赖、compatibility façade 与 behavior-preserving verification contract。

### Modified Capabilities

- 无。现有 user-visible requirements 不发生变化。

## Impact

- 主要影响 `src/features/messages/components/Messages.tsx`、`MessagesTimeline.tsx`、`MessagesRows.tsx` 及其直接 helper/test。
- 新增 `src/features/messages/orchestration/**`、`timeline/**`、`rows/**`，核心 public entry 路径保持原位。
- 现有外部 import、`MessagesProps`、Markdown/toolBlocks API 与 runtime/backend contract 保持兼容。
- 不增加 package dependency；验证使用现有 Vitest、ESLint、TypeScript 和 large-file governance。

## 目标与边界

- 目标是 architecture-only refactor，不是产品功能或视觉改版。
- Scope 严格限定为核心三件套及直接 helper；跨 feature contract 只读取、不重写。
- 每一阶段必须可独立验证和回滚。

## 方案比较

1. **渐进式领域拆分（采用）**：compatibility façade + typed models + move-only passes，风险最低且可持续交付。
2. **只移动文件**：Diff 小，但 48/87 props 与职责耦合基本不变，无法实现目标。
3. **一次性重写**：目录可快速变整齐，但 streaming/virtualization/bottom-follow 行为等价无法可靠证明，拒绝采用。

## 非目标

- 不修改 UI、CSS、i18n、Markdown/toolBlocks 内部行为。
- 不修改 Provider、thread lifecycle、history parser、Tauri/Rust contract。
- 不引入 Context-based mega provider、全局 store 或新 dependency。

## 验收标准

- 所有现有 messages regression tests 通过。
- full lint/typecheck/test/large-file gates 通过。
- 公开 import 与 user-visible behavior 保持不变。
- 目录与依赖方向符合 design，并且不存在新增 circular dependency。
