# message-process-phase-collapse Specification

## Purpose

定义对话幕布（Native + Shared 共用 Messages 核）过程相位折叠契约：以 user turn
终稿 assistant 为 ownership 边界，吸收 mid-turn 计划文之前的孤儿 process，hard-unmount
折叠体，对齐 Shared process-before-prose 干净呈现。

## Requirements

### Requirement: Process Phase Collapse MUST Use Turn-Final Ownership

对话幕布过程相位折叠 MUST 将同一个 user turn 内、介于上一条 user message 与该 turn
**最后一条有可见正文的 assistant message** 之间的全部 collapsible process items
（`reasoning` / `tool` / `explore`）归属到该终稿 assistant 的单一 phase。
mid-turn assistant 计划/问候正文 MUST 保留在时间线，MUST NOT 被并入 phase body。
折叠态 MUST hard-unmount process rows，仅保留 `已处理 · …` chip；展开 MUST 能 remount
被吸收的 process rows（含原先位于 mid-assistant 之前的「孤儿」reasoning）。

#### Scenario: Native stream with orphan reasoning before mid-turn plan text

- **WHEN** timeline 为
  `user → reasoning → assistant(plan) → tools/reasoning… → assistant(final)`
  且可渲染 process 步数 `> 1`
- **THEN** 折叠后 MUST NOT 在 plan 文之上单独保留被隔开的孤儿 `思考过程` 行
- **AND** 终稿上方 MUST 出现单一 process phase chip，其 breakdown 计入被吸收的
  reasoning 与可见 tools
- **AND** plan 正文 MUST 仍可见

#### Scenario: Multi-segment assistants share one turn-final chip

- **WHEN** 同一 user turn 内存在
  `tools1 → assistant(A1) → tools2 → assistant(A2)` 且 process 总步数 `> 1`
- **THEN** process phase MUST 仅挂在 `A2`
- **AND** `tools1` 与 `tools2` MUST 一并归属 `A2` 的 phase（折叠时 unmount）
- **AND** `A1` 正文 MUST 保留

#### Scenario: Single-step process including lone reasoning folds into the chip

- **WHEN** turn-final 之前仅有 1 个可渲染 process 步（含仅 1 条 reasoning / 思考过程）
- **THEN** MUST 创建 process phase chip（例如 `已处理 · 思考 1 次`）
- **AND** 该 process 行在折叠态 MUST hard-unmount，不得作为顶部孤儿 `思考过程` 单独挂载
- **AND** Native 与 Shared 共用同一门槛，行为一致

#### Scenario: Trailing in-progress process stays live

- **WHEN** 最后一条 assistant 终稿之后仍有 running tool/explore
- **THEN** 这些 trailing process items MUST NOT 被并入已完成终稿的 phase
- **AND** MUST 保持展开可见直到后续终稿落地或回合结束
