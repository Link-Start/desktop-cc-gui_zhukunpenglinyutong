## Why

「使用其他 Provider 继续」在 `running`（传递/校验上下文）阶段会禁用底部「取消」，且 `closeProviderContinuationDialog` 对 `running` 直接 return。目标 Provider/API 卡住时用户无法放弃弹窗，只能等待超时或失败。需要把「取消」定义为可在任意阶段安全放弃本次续接 UI，且不修改来源 Session、不劫持当前会话焦点。

## 目标与边界

- `preparing` / `confirm` / `running` / `error` 任意阶段，用户都能通过底部「取消/关闭」关闭 Dialog。
- 取消语义是「放弃本次续接接管结果」：来源 Session 内容、binding、当前选中线程 MUST 保持不变。
- `running` 中取消后，若 in-flight `createNativeProviderContinuation` 晚到成功，Frontend MUST NOT 自动 `onSelectThread`、MUST NOT 切换 active Provider 记忆/激活。
- 不引入后端 hard-abort API（本期无 `cancel_native_provider_continuation`）；后端 invoke 可继续跑完，target 可能成为 orphan，但不改 source。
- `prepared` 且无 result identity 的 operation 在 cancel 时仍走既有 `discard_prepared`；已进入 `creating`/`ready`/`recovery-required` 的 operation MUST NOT 被 discard 删除。

## 非目标

- 不修复「图1→图2 过慢」的性能根因（bootstrap / Provider latency）。
- 不新增右上角 ×（可选后续；本期底部取消即可完成能力）。
- 不新增后端 cancel/abort command 或强制杀掉 CLI 进程。
- 不改变 prepare-only、一次确认、idempotent recovery、source 只读 contract。
- 不清理已创建的 orphan target Session（可在列表中存在；重试路径已假定 target 可能已创建）。

## What Changes

- 修改 `ProviderContinuationDialog`：`running` 时底部取消不再 disabled；`onOpenChange` 允许关闭。
- 修改 `closeProviderContinuationDialog`：允许 `running` 关闭；将 `operationId` 记入 canceled set。
- 修改 `confirmProviderContinuation` 成功/失败后处理：若 operation 已取消，忽略 late success side effects 与 error dialog 回写。
- 补充 Dialog / hook Vitest：running 可取消；late success 不切线程。
- Delta 更新 `native-provider-continuation`：明确 running 可取消与 late-success 忽略契约。

## 方案取舍

### 方案 A：仅 UI 解禁取消按钮（不采用）

去掉 `disabled={isRunning}` 但 hook 仍对 running return → 假取消。

### 方案 B：UI 解禁 + close 支持 running + late-success 防护（采用）

最小前端改动即可解卡死；source 安全；晚到成功不劫持焦点。代价是 backend 仍可能留下 orphan target。

### 方案 C：后端 hard-abort（不采用）

需新增 cancel command 与 CLI 进程杀伤，范围过大，且 continuation 已创建 target 后 abort 语义复杂；本期不做。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `native-provider-continuation`: 补充 Dialog 在 target delivery/running 阶段可取消，以及 canceled operation 忽略 late success 的 frontend 行为契约。

## Impact

- Frontend：`ProviderContinuationDialog.tsx`、`useSidebarMenus.ts`、对应 tests。
- Backend：无变更。
- Contract：`openspec/specs/native-provider-continuation/spec.md` delta under this change。
- Dependencies：无新增依赖。

## 验收标准

- running（如「正在传递上下文…」）时底部「取消」可点，点击后 Dialog 立即关闭。
- 取消后用户停留在当前会话；来源 Session 内容与 binding 不变。
- 取消后 late `create` success MUST NOT 自动选中 target、MUST NOT activate destination provider。
- preparing/confirm 取消仍 discard prepared-only operation。
- focused Vitest 通过；`openspec validate` 对本 change 通过。
