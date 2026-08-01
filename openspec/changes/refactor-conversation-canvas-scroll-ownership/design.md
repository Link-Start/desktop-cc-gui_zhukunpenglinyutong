# Design: refactor-conversation-canvas-scroll-ownership

## Context

完整架构与红队补洞见：

`docs/plans/2026-08-01-conversation-canvas-scroll-ownership-architecture.md`

本 design 只固定 **实现切片** 与模块边界，避免与长文 DESIGN 双源漂移：实现以该文档 §3–§4.4 为合同，本文件记录落地顺序与风险。

## Goals / Non-Goals

**Goals**

1. 纯函数 `scrollAuthorityMachine` + 常量可单测。
2. Controller 以 machine 决策 **mode / forced 生命周期 / 明确上滚仲裁 / pin 资格**。
3. WriteTicket applied ring 参与程序回声识别（与既有 fingerprint 双跑兼容，正确性倾向 ticket）。
4. settle/send 退役与 safetyTimeout 可观测（reason code 字符串）。

**Non-Goals**

- Phase 一次删光全部 echo 指纹逻辑（迁移期双跑）。
- 重写 virtualizer 库；仅保证 pin 决策不依赖「仅 2.4s」。
- Composer chrome 全量监听可二期；machine 已支持 `chrome-resize` kind。

## Decisions

### D-impl-1：增量接线而非重写 MessagesCore

- **采用**：在 `useMessagesScrollController` 内持有 `authorityStateRef`，turn-boundary / RO / wheel 调用 pure reduce。
- **否决**：一次性拆光 Core 1.8k 行（风险高、难保回归绿）。

### D-impl-2：stick deadline 与 machine 并存一期

- 旧 `stickToBottomDeadlineRef` 在双跑期仍驱动 recheck；machine 的 `safetyTimeoutAt` 与 **稳态采样** 决定「是否继续 pin」。
- 退役条件优先 machine：`canRetireForced` → stable | safety-timeout | hold。

### D-impl-3：常量字面量

见 DESIGN §4.4；实现落在 `scrollAuthorityConstants.ts`。

## Module map

| 文件 | 职责 |
|------|------|
| `scrollAuthorityConstants.ts` | 阈值常量 |
| `scrollAuthorityTypes.ts` | Mode / Intent / Geometry / Ticket 类型 |
| `scrollAuthorityMachine.ts` | pure reduce / 仲裁 / 稳态 / 退役 |
| `scrollWriteTicket.ts` | ticket 签发、applied ring |
| `useMessagesScrollController.ts` | 接线 DOM / RO / wheel |
| 既有 `messagesScrollConvergence.ts` | Actuator 执行 |
| 既有 `messagesScrollEcho.ts` | 兼容 fingerprint + clamp 几何 |

## Risks

| 风险 | 缓解 |
|------|------|
| 回归 flaky | 先绿 machine 单测；再改 controller 行为，跑 live-behavior |
| forced 饿死 free | safetyTimeout 8s |
| 双状态漂移 | Mode↔Owner 映射表单测 |

## Migration

1. Machine + tests  
2. Controller 集成 forced/stick/user 仲裁  
3. 回归  
4. 文档/OpenSpec validate  
5. **用户实机**（本 change 不 commit）
