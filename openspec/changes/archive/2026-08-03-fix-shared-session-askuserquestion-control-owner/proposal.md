## Why

Shared Session 中 Claude 的 `AskUserQuestion`（`mcp__ccgui__AskUserQuestion`）会出现
「工具卡转圈、提问框不弹出、Stop 后会话卡住」。根因是 Shared **control 事件**
（`item/tool/requestUserInput`）在前端 fail-closed：必须解析完整
`sharedControlOwner`，而 Claude 映射事件把 `params.turnId` 写成 assistant item id，
与 `sharedOwner.runtimeTurnId`（attempt 的 runtime turn）不一致，事件被静默丢弃；
MCP HTTP 仍阻塞等待答案，turn 表现为假死。

Native 会话没有 Shared control claim，同一 MCP 路径可正常弹窗。这是适配缺口，不是
AskUserQuestion 能力本身失效。

## 目标与边界

- Shared + Claude（含 default/acceptEdits MCP 桥与 plan native 路径）收到
  `item/tool/requestUserInput` 后，**必须**在 Shared 幕布弹出可交互提问卡。
- 用户作答后 MUST 回传给真实 Owner native turn，MCP/oneshot 路径可继续 turn。
- 保持 fail-closed：缺少完整 Shared owner / 跨 owner 污染时仍不得错误展示。
- 修正 Claude 与 Shared projection 的 **turn 身份对齐**，不重做 UI。

## 非目标

- 不改变 AskUserQuestion 卡片 UI、多题 tab、secret、stale settlement 语义。
- 不放开「仅凭 thread 身份推断 control owner」（防跨线）。
- 不修改 Codex plan-mode `requestUserInput` 策略（code mode block 等）。
- 本变更不强制做 Stop/MCP 超时的完整重构；若顺手可观测则加，否则单独立项。

## What Changes

- Claude `EngineEvent::RequestUserInput` → app-server 时：`params.turnId` 使用
  forwarder 的真实 `turn_id`（`turn_id_context`），不再用 assistant item id。
- Shared projection：对 control 关键方法（至少 `item/tool/requestUserInput`）
  **强制**将 `turnId`/`turn_id` 对齐到 `owner.runtime_turn_id`（覆盖 or_insert）。
- 回归：Rust unit + 前端 Shared control owner 解析；必要时补 shared 场景事件测试。
- Spec delta：`codex-chat-canvas-user-input-elicitation` 增加 Shared 幕布可达性要求。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `codex-chat-canvas-user-input-elicitation`：Shared Session 下
  `requestUserInput` / AskUserQuestion 必须可达且可结算，不得因 turn 身份投影
  不一致被静默丢弃。

## Impact

- **Rust**: `src-tauri/src/engine/events.rs`，`shared_runtime_coordinator.rs`
- **Frontend**: 主要为既有 fail-closed 门禁的契约验证；通常无需改门禁逻辑
- **Runtime**: Shared Claude 中途提问恢复可用；native 路径行为保持
- **风险**: turnId 语义从「assistant item 关联」改为「runtime turn」——card 锚定
  仍靠 `itemId=askuserquestion-*`，与既有 tail 布局注释一致

## 技术方案取舍

| 选项 | 做法 | 取舍 |
|------|------|------|
| A | 仅改 Claude `turnId` 映射 | 根因直击；其他 engine 类似错位仍可能漏 |
| B | 仅 projection 强制覆盖 turnId | 兜住所有 engine；不修 Claude 语义源 |
| **C（选用）** | A + B 双保险 | 源正确 + Shared 投影硬对齐；测试双覆盖 |

## 验收标准

1. Shared Claude default 模式触发 AskUserQuestion → 幕布弹出选项卡。
2. 作答后 turn 继续，MCP 工具结束，无永久 processing。
3. Native Claude AskUserQuestion 回归仍可用。
4. 缺少 `sharedOwner` / turn 身份故意错位时仍 fail-closed（不误弹到错误 Shared）。
5. `cargo test` 相关用例 + Vitest control-owner / requestUserInput 用例通过。
