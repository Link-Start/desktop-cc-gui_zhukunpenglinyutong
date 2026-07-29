## Why

Native Session 当前只能沿用原 Provider；既有 Codex 跨 Provider fork 通过复制 vendor
history file 并写入 `parentThreadId` 实现，既破坏 vendor history 所有权，也把 Provider
续接误投影成 Subagent。Change D 需要在不修改来源会话的前提下，建立可审计、可恢复、
fail-closed 的跨 Provider Continuation。

## 目标与边界

- 为 Claude session JSONL、Codex rollout 与 Kimi stable history surface 提供只读
  `NativeHistoryReader`。
- 在任何目标 Runtime side effect 前，冻结并持久化 immutable
  `NativeHistoryMaterialization` 与完整 `ContextPackage`。
- 创建新的 Native Session 与 Provider Binding；来源 Session 保持不变。
- 持久化 `SessionOrigin=provider-continuation` 与 `ConversationFamilyRef`，并在 Sidebar
  顶层展示“供应商续接”及来源导航。
- 对 unstable cursor、损坏、权限不足、版本不支持、artifact checksum 不匹配返回 typed
  error，禁止猜测和静默降级。

## 非目标

- 不支持 Native Session 内热切 Provider。
- 不把来源 Native History 写入 Shared Canonical Event Log。
- 不修改、复制或伪造 vendor history file。
- 不把 Provider Continuation 写入 Subagent relationship writer，也不使用
  `parentThreadId`。
- 不实现 Conversation Family 折叠树、Shared Session 历史 Turn fork 或远期
  Orchestration。

## What Changes

- 新增统一的 Native history probe/read contract、三类 adapter、typed error 与 fidelity
  contract tests。
- 新增 continuation preparation/materialization persistence；相同 operation retry 复用
  frozen artifacts，不重读已漂移来源。
- 扩展 `ContextPackage` 支持 `native-history` source identity、fingerprint 与 cursor range。
- 新增 Native Provider Continuation command/service/UI flow，替换 Codex
  `native-provider-rebind` 的 vendor history copy 路径。
- 扩展 session catalog metadata，持久化 Origin/Family，并保持 Continuation 顶层展示。
- 新增“供应商续接”标签、查看来源会话导航、degraded/unsupported/recovery feedback。

## 方案取舍

### 方案 A：只读 Reader + immutable materialization + ContextCompiler（采用）

统一三家 Runtime 的来源读取边界，目标 side effect 前冻结证据，重试只读取 artifact。
实现量较大，但满足可审计、来源不变、跨 Runtime compatibility 与 crash recovery。

### 方案 B：复制/改写 vendor history 后原生 resume（拒绝）

Codex 旧路径代码更少，但依赖私有文件布局，跨 Provider 时会制造 vendor-owned history，
无法统一 Claude/Kimi，并会把 Continuation 错当 Fork/Subagent。

### 方案 C：直接把 UI transcript 拼成首条 prompt（拒绝）

可快速展示，但 UI Projection 不是事实源，Tool pairing、omission、fidelity 与稳定 cursor
均不可证明，重试还可能重复注入。

## Capabilities

### New Capabilities

- `native-history-reader`: Native history 的稳定 probe/read、canonical-shaped 输出、typed
  error、fidelity 与 immutable materialization contract。
- `native-provider-continuation`: 跨 Provider Continuation 创建、恢复、Origin/Family、
  顶层标签与来源导航 contract。

### Modified Capabilities

- `shared-context-package`: 增加 `native-history` source fingerprint/cursor/checksum 语义。
- `engine-per-session-provider-binding`: Provider Continuation 创建新的独立 binding，禁止
  从来源继承旧 Provider 或回退 local/default。
- `workspace-session-catalog-projection`: Projection 暴露 Origin/Family，Continuation 顶层
  展示且不进入 Subagent tree。

## 验收标准

- Claude/Codex/Kimi reader 对 stable cursor 成功，对 unstable cursor typed unsupported。
- preparation 完成后来源文件变化或删除，retry 仍从 frozen artifact 得到同一 checksum。
- 新 Session 使用不同 Provider，继承 `familyId`，`lineageParentSessionId` 指向来源，且无
  `parentThreadId`。
- 删除来源 Session 不级联删除 Continuation。
- Sidebar 顶层显示“供应商续接”，可导航到仍存在的来源；来源缺失时给出可解释状态。
- 来源 Native History 不写 Shared Canonical Event Log；不复制或修改 vendor history。

## Impact

- Backend：`src-tauri/src/shared_context/**`、Native history loaders、session catalog
  metadata、Tauri/daemon command registry。
- Frontend：`src/services/tauri/**`、thread summary/mapping、Sidebar menu/row、Continuation
  creation status。
- Persistence：新增 app-owned continuation/materialization records 与 Artifact Store
  refs；不新增第三方依赖，不修改 vendor storage。
- Compatibility：Desktop 执行完整 Continuation；daemon 保持同名/camelCase payload，
  但在 remote adapter 尚未具备原生历史与 artifact owner 前返回 typed unsupported，禁止
  静默 fallback。现有同 Provider Fork 行为保留，跨 Provider 入口迁移为 Provider
  Continuation。
