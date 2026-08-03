# OpenSpec Change Index

本页是 `mossx` OpenSpec proposal 的当前入口。它只维护 active change 的执行状态，并把 archived change 路由到完整历史索引；详细治理快照仍以 [`../project.md`](../project.md) 为准。

- Updated At: `2026-08-03`
- Active proposals: `2`
- Archived proposals: `848`
- Main capability specs: `492`

## Active Proposals

| Change | Progress | Current gate | Artifacts |
| ------ | -------: | ------------ | --------- |
| [`fix-codex-collab-subagent-live-parity`](fix-codex-collab-subagent-live-parity/proposal.md) | implemented / need manual smoke | 代码已落地 + focused vitest/tsc 绿；待 Codex live wait 与其他 CLI 人工冒烟后 verify/archive | [proposal](fix-codex-collab-subagent-live-parity/proposal.md) · [design](fix-codex-collab-subagent-live-parity/design.md) · [tasks](fix-codex-collab-subagent-live-parity/tasks.md) · [specs](fix-codex-collab-subagent-live-parity/specs/) · [verification](fix-codex-collab-subagent-live-parity/verification.md) |
| [`add-linux-native-menu-localization`](add-linux-native-menu-localization/proposal.md) | 4/5 | NOT READY archive — Linux non-default language native menu smoke（原 GTK 缺陷边界，未在本机验证） | [proposal](add-linux-native-menu-localization/proposal.md) · [design](add-linux-native-menu-localization/design.md) · [tasks](add-linux-native-menu-localization/tasks.md) · [specs](add-linux-native-menu-localization/specs/) · [verification](add-linux-native-menu-localization/verification.md) |

## Active backlog notes（2026-08-03）

- **新增** `fix-codex-collab-subagent-live-parity`：Codex multi-agent 实时 wait 阶段幕布/Status 缺子代理呈现；history 已 OK。实现须 engine-gate，禁止回归 Claude/Grok/Kimi。
- 保留 `add-linux-native-menu-localization`（Linux 菜单实机 smoke）。

## Archived Proposals

- [完整归档提案索引](archive/README.md)
- [2026-08-03 三波 bulk archive](archive/README.md#2026-08-03) — verified + complete + shipped-with-manual-residual

## Lifecycle Rules

- 新 change 创建后，必须在本页补充 active proposal、任务进度和当前 gate。
- change 归档后，必须从 active table 移除，并在 [`archive/README.md`](archive/README.md) 对应日期下增加 proposal link。
- `tasks.md` 的 checkbox 是进度事实；`verification.md` 是 evidence / waiver 事实；本页不得覆盖 change-local truth。
- 历史归档目录名保留 archive date；不因后续重命名或文案整理修改既有路径。
- 本页 active 表可由磁盘 `openspec/changes/*` 重建。
