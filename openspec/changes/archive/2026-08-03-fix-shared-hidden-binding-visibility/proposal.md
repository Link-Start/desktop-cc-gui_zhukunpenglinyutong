## Why

Shared Session 在 Claude / Codex 下能正确隐藏 Hidden Native Binding，但 Grok / Kimi / OpenCode
发送后会在 sidebar 泄漏 `MOSSX_CONTEXT_PACK...` 等 native 行。根因是 binding identity 与
真实落盘 session id 对不齐，不是缺失一整套隐藏机制。需在既有 Hidden Binding 契约上做
engine 适配，否则 Shared 五引擎目标名存实亡。

## 目标与边界

- 让 Grok / Kimi / OpenCode 的 Shared-owned Hidden Binding **不进入**用户可见 native 列表，
  行为对齐 Claude / Codex。
- 复用既有链路：`nativeThreadIds` → `hiddenSharedBindingIds` → thread list / catalog merge。
- 对齐 Claude 的 identity 模式：能预分配的预分配（Grok `-s`）；不能预分配的事后 rebind
  （Kimi SessionHint / OpenCode session id）。
- 仅修 Shared 路径；Native 用户会话可见性与创建行为不变。

## 非目标

- 不重做 Shared V2 architecture / Context Protocol / Send pipeline 状态机。
- 不用「标题含 MOSSX_CONTEXT」启发式隐藏。
- 不批量清理历史已泄漏 orphan native session（本次止住新漏；清理另案）。
- 不恢复 Gemini Shared。
- 不改用户主动创建的 Grok/Kimi/OpenCode Native Session 可见性。
- 不跑仓库全量测试；只跑受影响 focused tests。

## What Changes

- Shared V2 binding materialize：Grok 预分配 `grok:{uuid}`（不再长期挂 pending 占位）。
- Grok send identity：`continue_session=false` 时仍可使用 explicit session id 走 `-s`，
  使落盘 id 与 binding 一致。
- Kimi / OpenCode：首轮真实 id 出现后 durable binding rebind 到 `kimi:{id}` /
  `opencode:{id}`；runtime normalize 与 Claude 一样做 engine 前缀规范化（按需）。
- Frontend：`thread/started` pending rebind 从 `claude|codex` 扩到 shared 五引擎。
- Frontend：`hiddenSharedBindingIds` 同时收录 raw / `engine:raw` / pending 变体，防止
  前缀不一致漏过滤。
- 增量 tests：hide 用例覆盖 Grok/Kimi/OpenCode；Rust identity/rebind focused tests。

### 方案对比与取舍

- **方案 A：按标题启发式隐藏 `MOSSX_CONTEXT_*`。** 实现快，但误伤用户讨论 context 协议的
  正常会话，且不修 identity 契约。拒绝。
- **方案 B：为 Grok/Kimi/OpenCode 另写一套 sidebar 过滤。** 与 Claude/Codex 分叉，后续必
  漂移。拒绝。
- **方案 C：适配既有 Hidden Binding identity + rebind + hide set 扩展（Claude 模式）。**
  最小改动、契约统一。采用。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `shared-session-thread`: 明确 Grok/Kimi/OpenCode Hidden Binding 与 Claude/Codex 一样
  不得进入 native list surfaces；pending rebind 覆盖五引擎。
- `shared-send-pipeline`: Binding materialize / identity ACK 对 Grok 预分配、对
  Kimi/OpenCode 真实 id 回写后才视为 established identity（用于 hide 与 resume）。

## Impact

- Backend：`shared_session_v2.rs` materialize、`shared_runtime_coordinator` identity
  normalize、`engine/grok.rs` session resolve、Kimi/OpenCode rebind 触点。
- Frontend：`useThreadActions` hide set、`useAppServerEvents` pending rebind。
- Specs：`shared-session-thread`、`shared-send-pipeline` delta。
- Storage：继续 `shared_binding_state.native_session_id`；无 schema migration。
- Dependencies：无新增依赖。

## 验收标准

- Shared Session 选 Grok 发一轮后，sidebar 只有 Shared 行，无 `MOSSX_CONTEXT_PACK...`。
- 同测 Kimi / OpenCode：Hidden Binding 不进 native 列表。
- Claude / Codex Shared hide 行为无回归。
- 非 Shared 的 Grok/Kimi/OpenCode native 会话仍可见、可打开。
- focused Vitest + focused Rust tests 通过；`openspec validate` strict 通过。
