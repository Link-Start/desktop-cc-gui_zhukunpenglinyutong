# OpenSpec Change Index

本页是 `mossx` OpenSpec proposal 的当前入口。它只维护 active change 的执行状态，并把 archived change 路由到完整历史索引；详细治理快照仍以 [`../project.md`](../project.md) 为准。

- Updated At: `2026-07-17`
- Active proposals: `10`
- Archived proposals: `631`
- Main capability specs: `403`

## Active Proposals

| Change | Progress | Current gate | Artifacts |
|---|---:|---|---|
| [`add-askuserquestion-default-mode-mcp-bridge`](add-askuserquestion-default-mode-mcp-bridge/proposal.md) | 10/12 | deferred `cargo test` 与 manual multi-select queue acceptance | [design](add-askuserquestion-default-mode-mcp-bridge/design.md) · [tasks](add-askuserquestion-default-mode-mcp-bridge/tasks.md) · [verification](add-askuserquestion-default-mode-mcp-bridge/verification.md) |
| [`add-linux-native-menu-localization`](add-linux-native-menu-localization/proposal.md) | 3/5 | deferred Rust validation 与 Linux startup localization smoke test | [design](add-linux-native-menu-localization/design.md) · [tasks](add-linux-native-menu-localization/tasks.md) · [verification](add-linux-native-menu-localization/verification.md) |
| [`optimize-conversation-streaming-render-perf`](optimize-conversation-streaming-render-perf/proposal.md) | 7/8 | rebuilt-app performance trace evidence | [design](optimize-conversation-streaming-render-perf/design.md) · [tasks](optimize-conversation-streaming-render-perf/tasks.md) · [verification](optimize-conversation-streaming-render-perf/verification.md) |
| [`harden-conversation-rendering-for-large-history`](harden-conversation-rendering-for-large-history/proposal.md) | 35/38 | heavy-history evidence、performance budget 与 human acceptance | [design](harden-conversation-rendering-for-large-history/design.md) · [tasks](harden-conversation-rendering-for-large-history/tasks.md) · [verification](harden-conversation-rendering-for-large-history/verification.md) |
| [`enable-claude-lightweight-streaming-and-frame-attribution`](enable-claude-lightweight-streaming-and-frame-attribution/proposal.md) | 15/18 | human FPS trace、visual fidelity acceptance 与 archive gate | [design](enable-claude-lightweight-streaming-and-frame-attribution/design.md) · [tasks](enable-claude-lightweight-streaming-and-frame-attribution/tasks.md) · [verification](enable-claude-lightweight-streaming-and-frame-attribution/verification.md) |
| [`2026-06-24-retire-opencode-and-gemini-cli`](2026-06-24-retire-opencode-and-gemini-cli/proposal.md) | 4/48 | large cross-layer implementation backlog | [design](2026-06-24-retire-opencode-and-gemini-cli/design.md) · [tasks](2026-06-24-retire-opencode-and-gemini-cli/tasks.md) |
| [`2026-06-24-infer-thread-rename-from-claude-codex-jsonl`](2026-06-24-infer-thread-rename-from-claude-codex-jsonl/proposal.md) | 0/31 | planned implementation backlog | [design](2026-06-24-infer-thread-rename-from-claude-codex-jsonl/design.md) · [tasks](2026-06-24-infer-thread-rename-from-claude-codex-jsonl/tasks.md) |
| [`2026-06-22-release-pipeline-cache-sccache`](2026-06-22-release-pipeline-cache-sccache/proposal.md) | 7/13 | live release、artifact、cache-size 与 fallback evidence | [design](2026-06-22-release-pipeline-cache-sccache/design.md) · [tasks](2026-06-22-release-pipeline-cache-sccache/tasks.md) · [verification](2026-06-22-release-pipeline-cache-sccache/verification.md) |
| [`fix-sidebar-session-catalog-progressive-loading`](fix-sidebar-session-catalog-progressive-loading/proposal.md) | 0/8 | implementation 与 large-history evidence backlog | [design](fix-sidebar-session-catalog-progressive-loading/design.md) · [tasks](fix-sidebar-session-catalog-progressive-loading/tasks.md) |
| [`redesign-workspace-sidebar-session-loading`](redesign-workspace-sidebar-session-loading/proposal.md) | 0/11 | cross-capability implementation 与 continuity evidence backlog | [design](redesign-workspace-sidebar-session-loading/design.md) · [tasks](redesign-workspace-sidebar-session-loading/tasks.md) |

## Archived Proposals

- [完整归档提案索引](archive/README.md) — 631 个 proposal，按月份 / 归档日期分组。
- [2026-07-17 归档批次](archive/README.md#2026-07-17) — 包含最近两轮 verified closure 与 manual QA waiver closure。

## Lifecycle Rules

- 新 change 创建后，必须在本页补充 active proposal、任务进度和当前 gate。
- change 归档后，必须从 active table 移除，并在 [`archive/README.md`](archive/README.md) 对应日期下增加 proposal link。
- `tasks.md` 的 checkbox 是进度事实；`verification.md` 是 evidence / waiver 事实；本页不得覆盖 change-local truth。
- 历史归档目录名保留 archive date；不因后续重命名或文案整理修改既有路径。
