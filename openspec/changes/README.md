# OpenSpec Change Index

本页是 `mossx` OpenSpec proposal 的当前入口。它只维护 active change 的执行状态，并把 archived change 路由到完整历史索引；详细治理快照仍以 [`../project.md`](../project.md) 为准。

- Updated At: `2026-08-04`
- Active proposals: `5+`（以磁盘 `openspec/changes/*` 为准）
- Archived proposals: `848+`
- Main capability specs: `492`

## Active Proposals

| Change | Progress | Current gate | Artifacts |
| ------ | -------: | ------------ | --------- |
| [`fix-assistant-duplicate-render-native-shared`](fix-assistant-duplicate-render-native-shared/proposal.md) | implemented / await human check | Shared+Native：assistant 单气泡 A2+A 回显 + 跨 id 双气泡收敛已落地；focused vitest 48/48；**不 commit，交用户审批** | [proposal](fix-assistant-duplicate-render-native-shared/proposal.md) · [design](fix-assistant-duplicate-render-native-shared/design.md) · [tasks](fix-assistant-duplicate-render-native-shared/tasks.md) · [specs](fix-assistant-duplicate-render-native-shared/specs/) |
| [`fix-live-settle-assistant-tool-order`](fix-live-settle-assistant-tool-order/proposal.md) | artifacts ready / await apply | Shared×Claude：流式对、结束后偶发结论在工具前、重开历史恢复；segment+live-text settle 同源修复；**artifacts 齐，待审后实现** | [proposal](fix-live-settle-assistant-tool-order/proposal.md) · [design](fix-live-settle-assistant-tool-order/design.md) · [tasks](fix-live-settle-assistant-tool-order/tasks.md) · [specs](fix-live-settle-assistant-tool-order/specs/) · [分析](../../docs/analysis/live-settle-assistant-tool-order-2026-08-04.md) |
| [`fix-claude-background-shell-settlement`](fix-claude-background-shell-settlement/proposal.md) | artifacts ready / design review | Issue #983：result 后 5s grace 误杀 Claude 结构化后台 Shell；全平台 structured blocker settlement；**待用户审 design，未实现** | [proposal](fix-claude-background-shell-settlement/proposal.md) · [design](fix-claude-background-shell-settlement/design.md) · [tasks](fix-claude-background-shell-settlement/tasks.md) · [specs](fix-claude-background-shell-settlement/specs/) |
| [`fix-shared-model-picker-display-authority`](fix-shared-model-picker-display-authority/proposal.md) | artifacts ready / implementing | Shared Atomic 闭合态以 `selectedNextTarget` 为 display authority；catalog enrichment；禁止全局 model 回落；**不 commit，交用户审批** | [proposal](fix-shared-model-picker-display-authority/proposal.md) · [design](fix-shared-model-picker-display-authority/design.md) · [tasks](fix-shared-model-picker-display-authority/tasks.md) · [specs](fix-shared-model-picker-display-authority/specs/) |
| [`fix-shared-session-recovery-exit-closure`](fix-shared-session-recovery-exit-closure/proposal.md) | open | recovery exit ladder | [proposal](fix-shared-session-recovery-exit-closure/proposal.md) · [design](fix-shared-session-recovery-exit-closure/design.md) · [tasks](fix-shared-session-recovery-exit-closure/tasks.md) · [specs](fix-shared-session-recovery-exit-closure/specs/) |
| [`fix-shared-sidebar-hide-set-staleness`](fix-shared-sidebar-hide-set-staleness/proposal.md) | open | sidebar hide set | [proposal](fix-shared-sidebar-hide-set-staleness/proposal.md) · [tasks](fix-shared-sidebar-hide-set-staleness/tasks.md) |
| [`fix-codex-collab-subagent-live-parity`](fix-codex-collab-subagent-live-parity/proposal.md) | implemented / need manual smoke | 代码已落地 + focused vitest/tsc 绿；待 Codex live wait 与其他 CLI 人工冒烟后 verify/archive | [proposal](fix-codex-collab-subagent-live-parity/proposal.md) · [design](fix-codex-collab-subagent-live-parity/design.md) · [tasks](fix-codex-collab-subagent-live-parity/tasks.md) · [specs](fix-codex-collab-subagent-live-parity/specs/) · [verification](fix-codex-collab-subagent-live-parity/verification.md) |
| [`add-linux-native-menu-localization`](add-linux-native-menu-localization/proposal.md) | 4/5 | NOT READY archive — Linux non-default language native menu smoke（原 GTK 缺陷边界，未在本机验证） | [proposal](add-linux-native-menu-localization/proposal.md) · [design](add-linux-native-menu-localization/design.md) · [tasks](add-linux-native-menu-localization/tasks.md) · [specs](add-linux-native-menu-localization/specs/) · [verification](add-linux-native-menu-localization/verification.md) |

## Active backlog notes（2026-08-04）

- **新增** `fix-assistant-duplicate-render-native-shared`：Shared+Native assistant「渲染两遍」——单气泡 early-body 回显 + 跨 id 双气泡；OpenSpec Batch 1 齐，分批实现、不 commit。
- **新增** `fix-live-settle-assistant-tool-order`：幕布 live settle 后助手结论落到工具前（Shared×Claude 已确认；Shared/Native 共用 segment+live-text）；artifacts 齐，待 apply。
- **进行中** `fix-claude-background-shell-settlement`：Claude 后台 Shell 被 `CLAUDE_POST_RESULT_GRACE` 误杀（issue #983）；后端门闩已接线（helpers + `claude.rs` + fake-stream 回归）；FE waiting 文案为 P1；待 commit/收口。
- **新增** `fix-shared-model-picker-display-authority`：Shared/Atomic 底栏「选择模型」假空（Grok local 典型 B）；正规修复 display authority + Shared 禁全局回落 + catalog ensure。
- 保留 `fix-codex-collab-subagent-live-parity` / `add-linux-native-menu-localization` 等既有 active。

## Archived Proposals

- [完整归档提案索引](archive/README.md)
- [2026-08-03 三波 bulk archive](archive/README.md#2026-08-03) — verified + complete + shipped-with-manual-residual

## Lifecycle Rules

- 新 change 创建后，必须在本页补充 active proposal、任务进度和当前 gate。
- change 归档后，必须从 active table 移除，并在 [`archive/README.md`](archive/README.md) 对应日期下增加 proposal link。
- `tasks.md` 的 checkbox 是进度事实；`verification.md` 是 evidence / waiver 事实；本页不得覆盖 change-local truth。
- 历史归档目录名保留 archive date；不因后续重命名或文案整理修改既有路径。
- 本页 active 表可由磁盘 `openspec/changes/*` 重建。
