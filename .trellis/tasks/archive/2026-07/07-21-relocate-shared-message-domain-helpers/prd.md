# Relocate shared message domain helpers

## OpenSpec

- Change: `openspec/changes/relocate-shared-message-domain-helpers`
- Roadmap: Phase 6B

## 目标

- shared diff capability 收敛到 `src/utils/diff.ts`。
- command tags 与 agent-task notification 回到 neutral/producer owner。
- 跨 feature tool parser/classifier/status mapping 与 messages UI policy 分离。
- status-panel 不再 import messages-private `FileIcon`。

## 验收

- 对应 external private imports 清零。
- neutral modules 无 React/i18n/messages dependency。
- focused tests、typecheck、build、boundary gate、strict validation 通过。
