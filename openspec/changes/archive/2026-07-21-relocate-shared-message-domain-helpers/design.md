## Context

Phase 0 inventory 记录 38 条 inbound private imports。其中 shared diff、tool semantics、
command tags、agent-task notification 与 file icon 属于 leaf capability，可在不触碰
Messages orchestration 的情况下先偿还 dependency debt。

## Decisions

### Decision: 扩展既有 `src/utils/diff.ts`

复用已有 `parseDiff` owner，将 `computeDiff`、`computeDiffStats`、
`computeDiffFromUnifiedPatch` 与 types 合并到同一 neutral module。拒绝新建第二个
shared diff module，避免 API 分叉。

### Decision: pure tool semantics 与 UI policy 分离

新增 neutral module 只承载跨 3+ feature 的 parser/classifier/status mapping。
messages `toolConstants.ts` 继续组合并导出 UI-only labels、icons、CSS 与 translation
policy。Neutral owner 禁止 import React/i18n/messages。

### Decision: contract 回到 producer owner

`agentTaskNotification` 由 `engine-task-output/contracts` 拥有；messages 只消费
contract/parser。`commandMessageTags` 属于 root conversation normalization，因此移到
`src/utils`。

### Decision: FileIcon 统一 shared owner

优先扩展现有 `src/components/FileIcon.tsx` 兼容 `fileName/size` 与
`filePath/isFolder/isOpen/className`，用 tests 锁定两种调用形态；不保留两个同名视觉
owner。

## Risks / Mitigations

- tool constants 混合 pure 与 UI policy：先用 caller matrix 分类，只移动 proven shared
  symbols；messages re-export 作为短期 compatibility。
- diff caller output drift：先新增 pure unit tests，再迁移 callers。
- circular dependency：neutral modules 不得 import feature barrel；contracts 保持 leaf。

## Verification

逐 lane 运行 focused tests，之后统一运行 messages/tool/status/thread focused suites、
typecheck、build、boundary gate、large-file qualifier 与 strict validation。
