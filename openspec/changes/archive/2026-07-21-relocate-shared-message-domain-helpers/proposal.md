## Why

`threads`、`git`、`status-panel`、`session-activity`、`operation-facts` 与 root
utils 当前直接 import messages private `diffUtils`、`toolConstants`、
`commandMessageTags`、`agentTaskNotification` 和 `FileIcon`。这些 capability 已被
多个 feature 消费，但 ownership 仍位于 messages presentation 内，形成 reverse
dependency，并阻碍后续 `Messages`/rows/timeline 拆分。

## What Changes

- 将完整 diff capability 收敛到 `src/utils/diff.ts`，保留既有 `parseDiff`。
- 将 command message tags 移到 root neutral utility。
- 将 agent-task notification contract 移到 `engine-task-output/contracts`。
- 从 `toolConstants.ts` 提取被 3+ features 使用的 pure tool semantics；UI label、icon、
  class、translation policy 继续由 messages toolBlocks 拥有。
- 统一 status-panel 对 messages private `FileIcon` 的依赖到 shared component owner。
- 迁移 callers/tests，并在 compatibility window 内只保留必要 re-export。

## Impact

- Affected code：messages toolBlocks/utils、threads loader/rewind、git、status-panel、
  session-activity、operation-facts、engine-task-output 与 root utils。
- APIs：仅内部 import path/ownership 变化；conversation/tool payload 不变。
- Dependencies：不新增 dependency。
- Compatibility：diff output、tool classification、status mapping、command display 与
  agent-task parsing MUST 保持一致。

## 验收标准

- `threads`、root utils 与 peer features 不再 import 上述 messages private helpers。
- `src/utils/diff.ts` 覆盖 LCS guard、unified header exclusion 与 existing parseDiff。
- neutral modules 不 import React、i18n 或 messages components。
- focused suites、typecheck、build、boundary gate 与 OpenSpec strict validation 通过。
