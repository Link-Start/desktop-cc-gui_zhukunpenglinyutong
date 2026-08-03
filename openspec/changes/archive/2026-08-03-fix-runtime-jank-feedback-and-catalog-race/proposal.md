## Why

当前 runtime 同时存在三条可复现的主线程放大链路：跨 engine thread 切换时 provider catalog scope 短暂撕裂、diagnostics 每次 flush 全量重读去重并记录自身掉帧、live assistant snapshot 绕过 transient text channel 驱动 Timeline 父级重渲染。它们分别造成模型目录加载失败、idle 自激掉帧和 streaming 期间 246–622ms 卡顿，需要在同一轮以独立边界修复。

## 目标与边界

- provider catalog 请求必须来自同一个 active thread 的原子 `{ engineSource, providerProfileId }` scope。
- diagnostics 持久化必须增量处理、保持有界，并保留现有导出与重启恢复语义。
- streaming 正文增长必须局部更新 active message row，terminal settlement 仍收敛到 durable transcript。
- 三条修复保持独立测试与回滚边界，不引入新 dependency。

## 非目标

- 不改变 provider 配置格式、模型目录 precedence 或 runtime 启动协议。
- 不删除性能诊断能力，不降低诊断内容安全边界。
- 不重写消息 reducer、Timeline virtualization 或 Markdown renderer。
- 不以隐藏流式正文、降低最终一致性或吞掉结构事件换取性能。

## What Changes

- Provider catalog sync 改为使用 active thread 原子 scope，并拒绝 engine/provider 不匹配的 transient 请求；相同 catalog 不重复提交 React state。
- Renderer diagnostics 建立进程内 canonical snapshot，flush 仅增量 append、trim、persist，不再周期性全量 read/normalize/`JSON.stringify` dedupe。
- Active assistant 的增长 snapshot 复用 `liveAssistantTextChannel`；durable reducer 仅保留 identity shell、结构变化与 terminal convergence 所需更新。
- 增加 provider race、diagnostics bounded incremental persistence、streaming Timeline isolation 的 regression tests。

## 方案取舍

- **方案 A：增加 debounce / 延迟请求和渲染。** 改动小，但只缩小竞态窗口，无法消除 diagnostics 自激循环或 root render ownership，拒绝。
- **方案 B：修复状态所有权与增量边界。** catalog scope 原子化、diagnostics canonical cache、live text externalization 分别处理根因，采用。
- **方案 C：关闭 diagnostics 或丢弃 snapshot。** 可降低开销，但破坏可观测性和消息正确性，拒绝。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `model-provider-catalog-runtime`: catalog refresh 必须绑定一致的 thread engine/provider scope，transient mismatch 不得清空 last-good catalog。
- `performance-compatibility-diagnostics`: renderer diagnostics persistence 必须有界且不得通过全量重复处理形成自激掉帧。
- `conversation-render-surface-stability`: live assistant snapshot 正文增长必须保持 transient channel 隔离，并在 completion 收敛到 durable transcript。

## 验收标准

- 连续交叉切换 Claude/Codex thread 时，不产生 engine/provider mismatch 的 `get_engine_models` 调用，last-good catalog 不闪空。
- diagnostics 连续运行时，flush 成本不再随 persisted history 线性增长，且不会形成 `diagnostics-persist` 自记录循环。
- live assistant text 增长时 active row 可见更新，稳定 Timeline 输入不因纯正文 snapshot 改变；terminal、tool boundary 与 final Markdown 保持正确。
- focused Vitest、`npm run typecheck`、`npm run lint`、runtime contract gate 与 OpenSpec strict validation 通过。

## Impact

- Frontend hooks: provider catalog synchronization、engine model state。
- Renderer services: diagnostics buffering、dedupe、client store persistence。
- Conversation runtime: normalized thread item events、live assistant text channel、Timeline render ownership。
- Specs/tests: 上述三个 existing capabilities 及其 focused regression suites。
- 无 API breaking change、无 storage migration、无新增 dependency。
