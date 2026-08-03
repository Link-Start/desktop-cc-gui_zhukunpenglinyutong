# OpenSpec Change Index

本页是 `mossx` OpenSpec proposal 的当前入口。它只维护 active change 的执行状态，并把 archived change 路由到完整历史索引；详细治理快照仍以 [`../project.md`](../project.md) 为准。

- Updated At: `2026-08-03`
- Active proposals: `21`
- Archived proposals: `828`
- Main capability specs: `481`

## Active Proposals

| Change | Progress | Current gate | Artifacts |
| ------ | -------: | ------------ | --------- |
| [`adapt-subagent-cross-engine-display`](adapt-subagent-cross-engine-display/proposal.md) | 24/25 | in-progress；24/25 | [proposal](adapt-subagent-cross-engine-display/proposal.md) · [design](adapt-subagent-cross-engine-display/design.md) · [tasks](adapt-subagent-cross-engine-display/tasks.md) · [specs](adapt-subagent-cross-engine-display/specs/) |
| [`add-cc-switch-provider-import`](add-cc-switch-provider-import/proposal.md) | 14/15 | in-progress；14/15 | [proposal](add-cc-switch-provider-import/proposal.md) · [design](add-cc-switch-provider-import/design.md) · [tasks](add-cc-switch-provider-import/tasks.md) · [specs](add-cc-switch-provider-import/specs/) |
| [`add-cli-engine-visibility-toggle`](add-cli-engine-visibility-toggle/proposal.md) | 21/23 | in-progress；21/23 | [proposal](add-cli-engine-visibility-toggle/proposal.md) · [design](add-cli-engine-visibility-toggle/design.md) · [tasks](add-cli-engine-visibility-toggle/tasks.md) · [specs](add-cli-engine-visibility-toggle/specs/) |
| [`add-grok-engine`](add-grok-engine/proposal.md) | 25/26 | in-progress；25/26 | [proposal](add-grok-engine/proposal.md) · [design](add-grok-engine/design.md) · [tasks](add-grok-engine/tasks.md) · [specs](add-grok-engine/specs/) |
| [`add-linux-native-menu-localization`](add-linux-native-menu-localization/proposal.md) | 4/5 | NOT READY archive — Linux non-default language smoke | [proposal](add-linux-native-menu-localization/proposal.md) · [design](add-linux-native-menu-localization/design.md) · [tasks](add-linux-native-menu-localization/tasks.md) · [specs](add-linux-native-menu-localization/specs/) · [verification](add-linux-native-menu-localization/verification.md) |
| [`add-message-file-edit-scene-collapse`](add-message-file-edit-scene-collapse/proposal.md) | 15/16 | in-progress；15/16 | [proposal](add-message-file-edit-scene-collapse/proposal.md) · [design](add-message-file-edit-scene-collapse/design.md) · [tasks](add-message-file-edit-scene-collapse/tasks.md) · [specs](add-message-file-edit-scene-collapse/specs/) |
| [`add-shared-session-catalog-management`](add-shared-session-catalog-management/proposal.md) | 21/23 | in-progress；21/23 | [proposal](add-shared-session-catalog-management/proposal.md) · [design](add-shared-session-catalog-management/design.md) · [tasks](add-shared-session-catalog-management/tasks.md) |
| [`add-vendor-cli-lifecycle-header`](add-vendor-cli-lifecycle-header/proposal.md) | 11/12 | in-progress；11/12 | [proposal](add-vendor-cli-lifecycle-header/proposal.md) · [design](add-vendor-cli-lifecycle-header/design.md) · [tasks](add-vendor-cli-lifecycle-header/tasks.md) · [specs](add-vendor-cli-lifecycle-header/specs/) |
| [`compact-diff-push-button`](compact-diff-push-button/proposal.md) | 6/7 | in-progress；6/7 | [proposal](compact-diff-push-button/proposal.md) · [design](compact-diff-push-button/design.md) · [tasks](compact-diff-push-button/tasks.md) · [specs](compact-diff-push-button/specs/) |
| [`disable-session-activity-and-solo-mode`](disable-session-activity-and-solo-mode/proposal.md) | 9/10 | in-progress；9/10 | [proposal](disable-session-activity-and-solo-mode/proposal.md) · [design](disable-session-activity-and-solo-mode/design.md) · [tasks](disable-session-activity-and-solo-mode/tasks.md) · [specs](disable-session-activity-and-solo-mode/specs/) |
| [`enable-claude-lightweight-streaming-and-frame-attribution`](enable-claude-lightweight-streaming-and-frame-attribution/proposal.md) | 15/18 | NOT READY archive — quantified stream trace | [proposal](enable-claude-lightweight-streaming-and-frame-attribution/proposal.md) · [design](enable-claude-lightweight-streaming-and-frame-attribution/design.md) · [tasks](enable-claude-lightweight-streaming-and-frame-attribution/tasks.md) · [specs](enable-claude-lightweight-streaming-and-frame-attribution/specs/) · [verification](enable-claude-lightweight-streaming-and-frame-attribution/verification.md) |
| [`fix-messages-scroll-echo-follow-loss`](fix-messages-scroll-echo-follow-loss/proposal.md) | 29/32 | in-progress；29/32 | [proposal](fix-messages-scroll-echo-follow-loss/proposal.md) · [design](fix-messages-scroll-echo-follow-loss/design.md) · [tasks](fix-messages-scroll-echo-follow-loss/tasks.md) · [specs](fix-messages-scroll-echo-follow-loss/specs/) |
| [`fix-native-claude-provider-runtime-model-sync`](fix-native-claude-provider-runtime-model-sync/proposal.md) | 12/13 | in-progress；12/13 | [proposal](fix-native-claude-provider-runtime-model-sync/proposal.md) · [design](fix-native-claude-provider-runtime-model-sync/design.md) · [tasks](fix-native-claude-provider-runtime-model-sync/tasks.md) · [specs](fix-native-claude-provider-runtime-model-sync/specs/) |
| [`fix-native-session-quota-target-scoping`](fix-native-session-quota-target-scoping/proposal.md) | 7/9 | in-progress；7/9 | [proposal](fix-native-session-quota-target-scoping/proposal.md) · [design](fix-native-session-quota-target-scoping/design.md) · [tasks](fix-native-session-quota-target-scoping/tasks.md) · [specs](fix-native-session-quota-target-scoping/specs/) |
| [`fix-runtime-jank-feedback-and-catalog-race`](fix-runtime-jank-feedback-and-catalog-race/proposal.md) | 9/9 | Manual runtime evidence pending | [proposal](fix-runtime-jank-feedback-and-catalog-race/proposal.md) · [design](fix-runtime-jank-feedback-and-catalog-race/design.md) · [tasks](fix-runtime-jank-feedback-and-catalog-race/tasks.md) · [specs](fix-runtime-jank-feedback-and-catalog-race/specs/) · [verification](fix-runtime-jank-feedback-and-catalog-race/verification.md) |
| [`fix-shared-session-target-race-and-merge`](fix-shared-session-target-race-and-merge/proposal.md) | 20/21 | in-progress；20/21 | [proposal](fix-shared-session-target-race-and-merge/proposal.md) · [design](fix-shared-session-target-race-and-merge/design.md) · [tasks](fix-shared-session-target-race-and-merge/tasks.md) · [specs](fix-shared-session-target-race-and-merge/specs/) |
| [`reduce-client-polling-overhead`](reduce-client-polling-overhead/proposal.md) | 11/13 | Manual smoke checklist open | [proposal](reduce-client-polling-overhead/proposal.md) · [design](reduce-client-polling-overhead/design.md) · [tasks](reduce-client-polling-overhead/tasks.md) · [specs](reduce-client-polling-overhead/specs/) · [verification](reduce-client-polling-overhead/verification.md) |
| [`refactor-conversation-canvas-scroll-ownership`](refactor-conversation-canvas-scroll-ownership/proposal.md) | 23/26 | in-progress；23/26 | [proposal](refactor-conversation-canvas-scroll-ownership/proposal.md) · [design](refactor-conversation-canvas-scroll-ownership/design.md) · [tasks](refactor-conversation-canvas-scroll-ownership/tasks.md) · [specs](refactor-conversation-canvas-scroll-ownership/specs/) |
| [`replace-checkpoint-governance-with-session-overview`](replace-checkpoint-governance-with-session-overview/proposal.md) | 19/21 | in-progress；19/21 | [proposal](replace-checkpoint-governance-with-session-overview/proposal.md) · [design](replace-checkpoint-governance-with-session-overview/design.md) · [tasks](replace-checkpoint-governance-with-session-overview/tasks.md) · [specs](replace-checkpoint-governance-with-session-overview/specs/) |
| [`stabilize-client-runtime-and-diagnostics`](stabilize-client-runtime-and-diagnostics/proposal.md) | 21/22 | Quantified frame/first-delta trace pending | [proposal](stabilize-client-runtime-and-diagnostics/proposal.md) · [design](stabilize-client-runtime-and-diagnostics/design.md) · [tasks](stabilize-client-runtime-and-diagnostics/tasks.md) · [specs](stabilize-client-runtime-and-diagnostics/specs/) · [verification](stabilize-client-runtime-and-diagnostics/verification.md) |
| [`streamline-native-provider-continuation`](streamline-native-provider-continuation/proposal.md) | 13/14 | in-progress；13/14 | [proposal](streamline-native-provider-continuation/proposal.md) · [design](streamline-native-provider-continuation/design.md) · [tasks](streamline-native-provider-continuation/tasks.md) · [specs](streamline-native-provider-continuation/specs/) |

## Archived Proposals

- [完整归档提案索引](archive/README.md) — 全部 archived proposal，按月份 / 归档日期分组。
- [2026-08-03 第二波 complete 批量归档](archive/README.md#2026-08-03) — 追加 37 个任务完成可归档 proposal（共当日两波）。

## Lifecycle Rules

- 新 change 创建后，必须在本页补充 active proposal、任务进度和当前 gate。
- change 归档后，必须从 active table 移除，并在 [`archive/README.md`](archive/README.md) 对应日期下增加 proposal link。
- `tasks.md` 的 checkbox 是进度事实；`verification.md` 是 evidence / waiver 事实；本页不得覆盖 change-local truth。
- 历史归档目录名保留 archive date；不因后续重命名或文案整理修改既有路径。
- 本页 active 表可由磁盘 `openspec/changes/*` 重建；若与人工 gate 文案冲突，以 change-local `tasks.md` / `verification.md` 为准。
