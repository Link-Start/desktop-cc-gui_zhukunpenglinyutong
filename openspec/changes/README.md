# OpenSpec Change Index

本页是 `mossx` OpenSpec proposal 的当前入口。它只维护 active change 的执行状态，并把 archived change 路由到完整历史索引；详细治理快照仍以 [`../project.md`](../project.md) 为准。

- Updated At: `2026-07-25`
- Active proposals: `5`
- Archived proposals: `731`
- Main capability specs: `431`

## Active Proposals

| Change | Progress | Current gate | Artifacts |
|---|---:|---|---|
| [`add-linux-native-menu-localization`](add-linux-native-menu-localization/proposal.md) | 4/5 | Linux non-default-language startup smoke | [design](add-linux-native-menu-localization/design.md) · [tasks](add-linux-native-menu-localization/tasks.md) · [specs](add-linux-native-menu-localization/specs/) · [verification](add-linux-native-menu-localization/verification.md) |
| [`add-tokentracker-usage-dashboard`](add-tokentracker-usage-dashboard/proposal.md) | 21/21 | completion review / archive decision | [tasks](add-tokentracker-usage-dashboard/tasks.md) |
| [`add-vendor-cli-lifecycle-header`](add-vendor-cli-lifecycle-header/proposal.md) | 11/12 | 手工：未安装 / 最新 / outdated / npm view 失败 / 安装后刷新 smoke | [design](add-vendor-cli-lifecycle-header/design.md) · [tasks](add-vendor-cli-lifecycle-header/tasks.md) · [specs](add-vendor-cli-lifecycle-header/specs/) |
| [`enable-claude-lightweight-streaming-and-frame-attribution`](enable-claude-lightweight-streaming-and-frame-attribution/proposal.md) | 15/18 | Claude-stream trace、final fidelity 与 archive gate | [design](enable-claude-lightweight-streaming-and-frame-attribution/design.md) · [tasks](enable-claude-lightweight-streaming-and-frame-attribution/tasks.md) · [specs](enable-claude-lightweight-streaming-and-frame-attribution/specs/) · [verification](enable-claude-lightweight-streaming-and-frame-attribution/verification.md) |
| [`stabilize-client-runtime-and-diagnostics`](stabilize-client-runtime-and-diagnostics/proposal.md) | 21/22 | Quantified frame / first-delta trace retention | [design](stabilize-client-runtime-and-diagnostics/design.md) · [tasks](stabilize-client-runtime-and-diagnostics/tasks.md) · [specs](stabilize-client-runtime-and-diagnostics/specs/) · [verification](stabilize-client-runtime-and-diagnostics/verification.md) |
## Archived Proposals

- [完整归档提案索引](archive/README.md) — 731 个 proposal，按月份 / 归档日期分组。
- [2026-07-24 `close-cleanup-review-findings`](archive/2026-07-24-close-cleanup-review-findings/proposal.md) — 已同步 composer completion、semantic review cache/fallback、settings/workspaces corruption backup uniqueness；并删除 JCEF/notice residual dead branches。
- [2026-07-24 `preserve-corrupted-workspaces-on-load-and-notify`](archive/2026-07-24-preserve-corrupted-workspaces-on-load-and-notify/proposal.md) — 已同步 `workspaces-corruption-recovery`：`workspaces.json` 损坏时先隔离备份为 `.corrupted-<timestamp>.bak` 再回退空列表，quarantine 记录一次性 recovery notice，新增 `take_workspaces_recovery_notice` command，frontend 挂载后弹一次本地化 toast。
- [2026-07-24 `preserve-corrupted-app-settings-on-load`](archive/2026-07-24-preserve-corrupted-app-settings-on-load/proposal.md) — 已同步 `app-settings-corruption-recovery`：`settings.json` 损坏时先隔离备份为 `.corrupted-<timestamp>.bak` 再回退默认值，frontend 加载失败改为日志 + toast 可见。
- [2026-07-24 `notify-settings-recovery-after-corruption`](archive/2026-07-24-notify-settings-recovery-after-corruption/proposal.md) — 已同步 `app-settings-corruption-recovery`：quarantine 记录一次性 recovery notice，新增 `take_settings_recovery_notice` command，frontend 加载成功后弹一次本地化 toast。
- [2026-07-24 归档批次](archive/README.md#2026-07-24) — 31 个 verified proposal：Kimi 引擎、Agent Catalog、扩展管理面、AI PR 标题/正文、prompt enhancer 入口、source-aware 便签捕获、file history 迁入 git graph、git history 分支树恢复、PR range gate 软化、编排中心删除，以及 8 个死链 / 死分支清理与 AI review producer 接线等。
- [2026-07-23 `add-theme-aware-syntax-and-diff-tokens`](archive/2026-07-23-add-theme-aware-syntax-and-diff-tokens/proposal.md) — 已同步 theme preset syntax/diff tokens、稳定 root override 与外观设置实时预览。
- [2026-07-23 `fix-multi-repository-git-inline-diff-scope`](archive/2026-07-23-fix-multi-repository-git-inline-diff-scope/proposal.md) — 已同步 multi-repository scoped inline diff、discard-all、diff layout 与 command-header actions。
- [2026-07-23 最近活动批次](archive/README.md#2026-07-23) — `enhance-session-activity-panels`、`enhance-quick-switcher-hub`、`enhance-quick-switcher-nav-toggle` 已同步 `codex-chat-canvas-workspace-session-activity-panel` 与 `quick-context-switcher`。
- [2026-07-23 归档批次](archive/README.md#2026-07-23) — Python/Pyright 与 Go/gopls semantic navigation 已接入 external provider runtime。
- [2026-07-22 归档批次](archive/README.md#2026-07-22) — 已修复 multi-runtime/symlinked npm CLI discovery，并完成文件树定位与 completion selection index 对齐。
- [2026-07-20 归档批次](archive/README.md#2026-07-20) — Caveman bundled curated skill 已验证并同步 main spec。
- [2026-07-18 归档批次](archive/README.md#2026-07-18) — 5 个 implemented sync/archive + 3 个 stale/superseded/failed-experiment no-sync archive。

## Lifecycle Rules

- 新 change 创建后，必须在本页补充 active proposal、任务进度和当前 gate。
- change 归档后，必须从 active table 移除，并在 [`archive/README.md`](archive/README.md) 对应日期下增加 proposal link。
- `tasks.md` 的 checkbox 是进度事实；`verification.md` 是 evidence / waiver 事实；本页不得覆盖 change-local truth。
- 历史归档目录名保留 archive date；不因后续重命名或文案整理修改既有路径。
