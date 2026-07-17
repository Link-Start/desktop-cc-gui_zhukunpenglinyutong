# OpenSpec Change Index

本页是 `mossx` OpenSpec proposal 的当前入口。它只维护 active change 的执行状态，并把 archived change 路由到完整历史索引；详细治理快照仍以 [`../project.md`](../project.md) 为准。

- Updated At: `2026-07-18`
- Active proposals: `4`
- Archived proposals: `638`
- Main capability specs: `406`

## Active Proposals

| Change | Progress | Current gate | Artifacts |
|---|---:|---|---|
| [`add-linux-native-menu-localization`](add-linux-native-menu-localization/proposal.md) | 4/5 | Linux non-default-language startup smoke | [design](add-linux-native-menu-localization/design.md) · [tasks](add-linux-native-menu-localization/tasks.md) · [specs](add-linux-native-menu-localization/specs/) · [verification](add-linux-native-menu-localization/verification.md) |
| [`harden-conversation-rendering-for-large-history`](harden-conversation-rendering-for-large-history/proposal.md) | 35/38 | heavy-history evidence、performance budget 与 human acceptance | [design](harden-conversation-rendering-for-large-history/design.md) · [tasks](harden-conversation-rendering-for-large-history/tasks.md) · [specs](harden-conversation-rendering-for-large-history/specs/) · [verification](harden-conversation-rendering-for-large-history/verification.md) |
| [`enable-claude-lightweight-streaming-and-frame-attribution`](enable-claude-lightweight-streaming-and-frame-attribution/proposal.md) | 15/18 | shared heavy-history/Claude-stream trace 与 archive gate | [design](enable-claude-lightweight-streaming-and-frame-attribution/design.md) · [tasks](enable-claude-lightweight-streaming-and-frame-attribution/tasks.md) · [specs](enable-claude-lightweight-streaming-and-frame-attribution/specs/) · [verification](enable-claude-lightweight-streaming-and-frame-attribution/verification.md) |
| [`2026-06-22-release-pipeline-cache-sccache`](2026-06-22-release-pipeline-cache-sccache/proposal.md) | 11/13 | live SLO failed; residual-risk follow-up required | [design](2026-06-22-release-pipeline-cache-sccache/design.md) · [tasks](2026-06-22-release-pipeline-cache-sccache/tasks.md) · [specs](2026-06-22-release-pipeline-cache-sccache/specs/) · [verification](2026-06-22-release-pipeline-cache-sccache/verification.md) |

## Archived Proposals

- [完整归档提案索引](archive/README.md) — 638 个 proposal，按月份 / 归档日期分组。
- [2026-07-18 归档批次](archive/README.md#2026-07-18) — 4 个 implemented sync/archive + 2 个 stale/superseded no-sync archive。

## Lifecycle Rules

- 新 change 创建后，必须在本页补充 active proposal、任务进度和当前 gate。
- change 归档后，必须从 active table 移除，并在 [`archive/README.md`](archive/README.md) 对应日期下增加 proposal link。
- `tasks.md` 的 checkbox 是进度事实；`verification.md` 是 evidence / waiver 事实；本页不得覆盖 change-local truth。
- 历史归档目录名保留 archive date；不因后续重命名或文案整理修改既有路径。
