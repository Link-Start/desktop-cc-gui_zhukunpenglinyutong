# 校准 Change B 实现

## Goal

审查 `compose-shared-session-execution-target` 的实现证据，修复会造成错误路由、
重复执行或错误闭环的实现，并把 OpenSpec 与总任务清单恢复为真实状态。

## Requirements

- Shared V2 Send 必须使用 Composer 当前的 Provider/Model/Reasoning 选择。
- runtime 发送异常在没有 explicit negative ACK 证据时必须 fail closed，进入
  `recovery-required`，不得直接写成明确失败。
- Shared Send 非 `idle` 时锁定 Engine/Provider/Model/Reasoning 全部选择入口。
- 未接入生产链路或只有 synthetic test 的任务不得标记完成。
- 不实现 Change C 的 Context Compiler。

## Acceptance Criteria

- [ ] managed Provider 选择进入 `ExecutionTarget` 并透传 V2 Send。
- [ ] unknown send error 不写 `turnCommitted(failed)`，而是标记 recovery。
- [ ] Reasoning 选择在 Shared Send 非 `idle` 时不可修改。
- [ ] OpenSpec tasks 和 master checklist 与代码事实一致。
- [ ] 目标 Vitest、typecheck、lint、OpenSpec strict validation 通过。

## Technical Notes

- 复用现有 `resolveComposerSelection()`，不新增第二套 Provider selector。
- 保留 `mossx.sharedV2Send` 默认关闭，直到重开的 Gate 4 项真正闭环。
- 关联 OpenSpec change：`compose-shared-session-execution-target`。
