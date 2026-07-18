# OpenSpec Change Index

本页是 `mossx` OpenSpec proposal 的当前入口。它只维护 active change 的执行状态，并把 archived change 路由到完整历史索引；详细治理快照仍以 [`../project.md`](../project.md) 为准。

- Updated At: `2026-07-18`
- Active proposals: `4`
- Archived proposals: `640`
- Main capability specs: `406`

## Active Proposals

| Change | Progress | Current gate | Artifacts |
|---|---:|---|---|
| [`add-linux-native-menu-localization`](add-linux-native-menu-localization/proposal.md) | 4/5 | Linux non-default-language startup smoke | [design](add-linux-native-menu-localization/design.md) · [tasks](add-linux-native-menu-localization/tasks.md) · [specs](add-linux-native-menu-localization/specs/) · [verification](add-linux-native-menu-localization/verification.md) |
| [`derive-rate-limit-label-from-window-duration`](derive-rate-limit-label-from-window-duration/proposal.md) | 5/5 | Completed; pending sync/archive | [design](derive-rate-limit-label-from-window-duration/design.md) · [tasks](derive-rate-limit-label-from-window-duration/tasks.md) · [specs](derive-rate-limit-label-from-window-duration/specs/) |
| [`enable-claude-lightweight-streaming-and-frame-attribution`](enable-claude-lightweight-streaming-and-frame-attribution/proposal.md) | 15/18 | Claude-stream trace、final fidelity 与 archive gate | [design](enable-claude-lightweight-streaming-and-frame-attribution/design.md) · [tasks](enable-claude-lightweight-streaming-and-frame-attribution/tasks.md) · [specs](enable-claude-lightweight-streaming-and-frame-attribution/specs/) · [verification](enable-claude-lightweight-streaming-and-frame-attribution/verification.md) |
| [`stabilize-client-runtime-and-diagnostics`](stabilize-client-runtime-and-diagnostics/proposal.md) | 21/22 | Quantified frame / first-delta trace retention | [design](stabilize-client-runtime-and-diagnostics/design.md) · [tasks](stabilize-client-runtime-and-diagnostics/tasks.md) · [specs](stabilize-client-runtime-and-diagnostics/specs/) · [verification](stabilize-client-runtime-and-diagnostics/verification.md) |

## Archived Proposals

- [完整归档提案索引](archive/README.md) — 640 个 proposal，按月份 / 归档日期分组。
- [2026-07-18 归档批次](archive/README.md#2026-07-18) — 5 个 implemented sync/archive + 3 个 stale/superseded/failed-experiment no-sync archive。

## Lifecycle Rules

- 新 change 创建后，必须在本页补充 active proposal、任务进度和当前 gate。
- change 归档后，必须从 active table 移除，并在 [`archive/README.md`](archive/README.md) 对应日期下增加 proposal link。
- `tasks.md` 的 checkbox 是进度事实；`verification.md` 是 evidence / waiver 事实；本页不得覆盖 change-local truth。
- 历史归档目录名保留 archive date；不因后续重命名或文案整理修改既有路径。
