## Context

- 过程相位折叠位于 L3 Messages 核：`resolveCollapsedTimelineItems` →
  `processPhaseChips` → `messagesTimelineProjection` → `MiddleStepsCollapsedChip`。
- Native 与 Shared **共用**该核；Shared 干净主要来自 L1 `TurnCommitted` 的
  process-before-prose 投影顺序，而非另一套折叠开关。
- 旧算法：对每个有正文 assistant，向后 walk **连续** process，遇 non-process 即停。

## Goals / Non-Goals

**Goals**

- 消除 Native 流式「孤儿思考过程」与 Shared 干净形态的可见差。
- 保持 hard-unmount 性能模型与 shell hide 策略。
- 最小 diff、可单测锁定。

**Non-Goals**

- 改写 engine 事件顺序或 Shared projector。
- 自动判定「计划句 vs 实质结论」并隐藏 mid-assistant。

## Decisions

### Decision 1: Turn-final process ownership（采用）

对每个有正文的 assistant `A`：

1. 若同 user turn 内 `A` 之后还有其他有正文 assistant → `A` 不拥有 phase。
2. 否则 `A` 为 turn-final：收集 `(previousUser, A)` 开区间内全部 collapsible process
   （跳过 mid-assistant 正文，不把其并入 chip）。
3. `countRenderableCollapsedEntries > 1` 才建 phase；折叠时 hard-unmount process ids。

**Why not keep contiguous-only walk-back**

- 无法吸收 mid-plan 之前的 reasoning，正是孤儿根因。

**Why not hide all mid-assistant text**

- 用户仍可能需要「先做体检…」类计划句；图3 Shared 往往根本不投影 mid 句。

### Decision 2: 多段实质结论的 trade-off（接受）

```text
tools1 → A1 结论1 → tools2 → A2 结论2
```

旧：A1/A2 可各有 chip。  
新：tools1+tools2 全进 A2。  

产品明确以图3 单 chip 为主；若未来需要多段叙事 chip，另开启发式 change。

### Decision 3: insertBeforeItemId = 首个 process

折叠态：projection 用 `phaseByAssistantId` 把 chip 停在终稿前。  
展开态：chip 锚在 `phaseItems[0]`（可能是原孤儿）。展开顺序可能是
`chip → 孤儿 → plan → tools → final`，可接受；可选 follow-up 改为「最后一个
mid-assistant 之后的首个 process」以改善展开锚点。

## Risks

| Risk | Mitigation |
|------|------------|
| 多段结论过程归属变化 | proposal/design 明示；测试锁定 turn-final |
| 流式 phaseKey 从 plan 切到 final | expanded keys 不继承；边缘可接受 |
| 非 process 夹层（diff/review）仍露在中间 | 既有行为；不在本 change 范围 |

## Implementation Notes

- 入口：`collectTurnProcessItemsForFinalAssistant` + `resolveCollapsedTimelineItems`。
- Claude 双身份：`candidate.id === finalAssistant.id` 的 process 不进 chip。
- shell：仍先 `filterCanvasHiddenProcessTools`。

## Validation

见 `tasks.md` / `verification.md`。
