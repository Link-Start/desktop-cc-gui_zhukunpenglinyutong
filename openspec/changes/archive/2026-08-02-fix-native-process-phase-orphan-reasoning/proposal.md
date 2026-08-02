## Why

Native Session 多 CLI（Claude / Grok 等）流式幕布会出现**顶部孤儿「思考过程」**：

```text
思考过程（孤儿）
→ assistant 计划/问候正文
→ 已处理 · 思考 N 次 工具 M 次
→ assistant 终稿
```

Shared Session 历史（尤其 Grok）常呈现干净形态（产品对齐目标图3）：

```text
已处理 · 思考 N 次 工具 M 次
→ assistant 终稿
```

根因不是 Shared Claude 漏接折叠开关，而是 **过程相位折叠算法只 walk 终稿正上方连续 process**。Native 流式常在首个 reasoning 与后续 tools 之间插入 mid-turn assistant 计划文，打断 contiguity，导致开头 reasoning 无法进入 chip。Shared `TurnCommitted` 投影已是 process-before-prose，故历史路径少见该孤儿。

## 目标与边界

- 以 Shared 干净形态（图3）为产品目标：一个 user turn 在终稿处最多一个 `已处理` chip。
- Native 折叠语义改为 **turn-final ownership**：上一条 user → 该 turn **最后一条有正文的 assistant** 之间的全部 `reasoning` / `tool` / `explore` 归属该终稿 chip。
- mid-turn assistant 计划/问候正文 **保留在幕布**，不并进 chip。
- `count <= 1` 仍不折叠；trailing process（终稿后仍在跑）仍保持展开。
- 改动仅限 Messages 折叠归属（`resolveCollapsedTimelineItems`）与 focused Vitest；不改 engine adapter / Shared projector / IPC。

## 非目标

- 不隐藏 mid-turn assistant 计划正文（若产品要藏计划句，另开 change）。
- 不恢复「每个 assistant 各挂一个 chip」的多相位叙事。
- 不改 shell hide、fileEdit 场景折叠、ReasoningRow 单行展开态。
- 不改 Shared projection 顺序（已兼容）。

## What Changes

- `src/features/messages/orchestration/presentation/messagesViewModel.ts`
  - 新增 `collectTurnProcessItemsForFinalAssistant`：仅 turn 内 **last** 有正文 assistant 收集 process。
  - `resolveCollapsedTimelineItems` 改用该收集逻辑；hard-unmount / expand remount 模型不变。
  - 更新 `ProcessPhaseCollapse` 类型注释为 turn-final 语义。
- `messagesViewModel.collapseMiddleSteps.test.ts`
  - 孤儿 reasoning 跨 mid-assistant 吸收。
  - 多段 assistant 合并到 turn-final。
  - expand remount 顺序断言。
- OpenSpec：本 change 的 proposal / design / tasks / delta / verification。

## Capabilities

### New Capabilities

- `message-process-phase-collapse`：对话幕布过程相位折叠（turn-final ownership、孤儿 process 吸收、hard-unmount）。

### Modified Capabilities

- 无（既有 curtain/canvas 文档不强制改；本能力独立成 contract）。

## Impact

- Frontend Messages 过程折叠呈现（Native live + 任何走同一 `resolveCollapsedTimelineItems` 的路径，含 Shared 重载后的终稿形态）。
- 产品语义：多段实质结论之间的 tools 会并进 **最后一条** assistant 的 chip（对齐图3 的有意 trade-off）。
- 无 backend / DB / IPC 变更。

## 验收标准

1. Native Claude / Grok 多工具回合：终稿上方出现 `已处理 · 思考/工具…`，顶部不再单独挂被 mid-plan 隔开的孤儿 `思考过程`。
2. 展开 chip 可 remount 被吸收的 reasoning/tools（含原孤儿块）。
3. mid-turn 计划正文仍可见。
4. Shared 图3 形态不回归。
5. focused Vitest 全绿。
