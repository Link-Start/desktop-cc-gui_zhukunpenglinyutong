## Why

Change A–D 已建立 Canonical Fact、Shared Session、Context Compiler 与 Provider Continuation 的底层契约，但当前客户端没有把这些能力组成用户可操作的闭环：模型菜单按 CLI 而非 Provider Profile 分组，Kimi 能力边界被直接隐藏，续接确认使用系统原生 Dialog，Context control marker 还会作为普通消息和标题暴露。结果是“代码支持了切换”，用户却无法理解、选择或追溯切换。

本 change 以真实验收截图为输入，修复实现与既有规范之间的最后一公里偏差。重点不是扩展 runtime 能力，而是让现有能力以明确、可访问、可恢复的 UX 对用户可见。

## 目标与边界

- Shared Session composer 落地真实的 `CLI → Provider Profile → Model → Reasoning` 选择链路；提交时原子使用完整 `ExecutionTarget`。
- Native Session 的 Provider Continuation 使用产品内 React Dialog，展示目标 CLI、Provider、能力状态、降级信息和确认动作。
- Kimi 在相关选择面中可见；当前只验证为 continuation source 时，目标项必须禁用并解释原因，不得假装可用或静默消失。
- 将 `MOSSX_CONTEXT_PACKAGE`、`MOSSX_NATIVE_CONTEXT_V1` 与 ACK marker 识别为 control protocol，不作为普通标题/消息展示；改为可读的续接上下文卡片。
- Continuation 目标 Session 使用可读标题，并提供到来源 Session 的直接导航。
- 保留 dark-launch、ACK、checksum、idempotency、recovery 与原始 Native History 事实，不改写 vendor history。

## 非目标

- 不在缺少 capability probe 的情况下开放 Kimi 作为 Provider Continuation target。
- 不改变 Canonical Fact schema、Binding Key、Context Package checksum 或 ACK 判定。
- 不为普通 Native Session 提供“原地换 Provider”；跨 Provider 仍然创建独立 Continuation Session。
- 不引入新 UI framework、状态库或 model catalog 依赖。
- 不重构与本链路无关的 composer、sidebar 或 message rendering。

## What Changes

- Shared target picker 从 CLI 两级菜单校准为 Provider-aware 四级选择器，并显示 unavailable reason。
- Provider Continuation 从 context-menu 直接 side effect 改为受控 Dialog 确认。
- 续接 Dialog 展示目标、降级 mode、omissions 与 recovery；ready canvas card 展示可靠的来源/目标关系。
- control marker 从普通 transcript projection 中隔离；以 continuation card 和可读标题替代。
- 补充 Provider Profile 作用域、Kimi capability boundary、source navigation、marker projection、Windows/macOS/Linux 路径与 shell-free 行为测试。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `shared-session-engine-selection`: 四级选择器必须实际展示 Provider Profile 及该 Profile 的 model catalog，并显式展示不可用 CLI 的原因。
- `native-provider-continuation`: 续接前必须使用产品内 Dialog 展示目标、降级与能力边界；完成后必须提供来源导航和可读身份。
- `session-history-display-fidelity`: control protocol marker 不得成为标题或普通消息；Continuation 必须投影为可读上下文卡片。

## 方案对比与取舍

1. **推荐：复用现有 catalog、Continuation command 与 Radix primitives，只补齐 Provider-aware presentation 和受控交互。** 改动集中，底层 ACK/恢复契约不变，风险可由 scoped tests 覆盖。
2. **备选：新建统一 Target Registry 和全局 Selector framework。** 长期可抽象，但会扩大 Change A–D 的收口范围，引入重复缓存与状态同步；当前不采用。

## 验收标准

- Shared Session 中可从一个入口依次选择 CLI、Provider Profile、该 Profile 的 Model 与 Reasoning；同名 model 不会串到其他 Provider。
- Kimi 在 picker/continuation surface 可见，并根据已验证能力显示可用或带原因禁用。
- 续接过程中不调用 `window.alert`、`window.confirm` 或 Tauri native `ask/confirm`。
- Continuation 创建成功后，sidebar/canvas 不显示以 `MOSSX_` 开头的标题或普通消息。
- Canvas 显示来源、目标摘要，并能直接打开仍存在的来源 Session；来源缺失时明确不可用。mode/fidelity/recovery 只在存在真实 operation result 时由 Dialog 展示。
- 相关 Vitest、Rust tests、typecheck、scoped lint 与 OpenSpec strict validation 通过。

## Impact

- Frontend：composer target picker、sidebar continuation flow、conversation projection、continuation identity UI。
- Backend：仅在必要时补充 continuation display metadata/title；不改变执行和持久化协议。
- Specs/docs：同步既有三项 capability 与 A–D 人工验收计划。
- Dependencies：无新增依赖。
