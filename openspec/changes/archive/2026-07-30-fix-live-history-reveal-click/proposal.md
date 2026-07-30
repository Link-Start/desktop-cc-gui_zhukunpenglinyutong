## Why

长会话处于 live streaming 时，顶部“显示之前 N 条消息”仍展示为可点击入口，但点击后 `showAllHistoryItems` 虽然更新，`buildLiveTailWorkingSet()` 仍继续裁剪历史，导致入口与旧消息均无变化。该回归违反现有 `conversation-render-surface-stability` 中“show all history keeps full derivation”的行为契约。

## 目标与边界

- 恢复 live streaming 期间显式历史展开入口的有效性。
- 保留未展开状态下 bounded tail working set 的性能策略。
- 仅修改 frontend presentation window 与定向测试，不触碰 runtime、storage、Tauri command 或消息协议。

## 非目标

- 不调整 `STREAMING_VISIBLE_WINDOW` / `VISIBLE_MESSAGE_WINDOW`。
- 不重构 timeline virtualization、scroll controller 或 anchor navigation。
- 不改变 history reveal 的文案、位置与视觉设计。

## What Changes

- `showAllHistoryItems=true` 时，`buildLiveTailWorkingSet()` 返回完整 conversation item list，不再应用 live tail trimming。
- 保持 `showAllHistoryItems=false` 的 live conversation 继续使用 bounded tail working set。
- 增加 unit 与 component regression coverage，验证 streaming 状态点击历史入口后旧消息出现且入口消失。

## 方案对比

- **方案 A（采用）**：恢复 helper 对 `showAllHistoryItems` 的既有分支。改动最小，直接符合 main spec；显式展开后承担完整 history derivation 成本，属于用户主动选择。
- **方案 B（拒绝）**：streaming 期间禁用或隐藏入口，回合结束后再允许展开。可维持 bounded cost，但违背当前可点击 affordance 与用户即时查看历史的需求。
- **方案 C（暂不采用）**：建立独立 frozen history snapshot lane，同时保留 live row 外部更新。性能上限更高，但涉及新的 presentation orchestration，超出本次 bugfix 范围。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `conversation-render-surface-stability`: 补充 live streaming 期间用户显式展开历史时必须退出 bounded working-set trimming 的验收场景。

## 验收标准

- live conversation 超过 working-set 上限时，未展开状态仍报告准确的 collapsed count。
- 点击“显示之前 N 条消息”后，最早历史消息进入渲染结果，collapsed indicator 消失。
- idle/full-history 与 collapsed streaming 的既有测试保持通过。
- targeted Vitest、TypeScript typecheck 与 OpenSpec strict validation 通过。

## Impact

- `src/features/messages/orchestration/presentation/messagesLiveWindow.ts`
- `src/features/messages/orchestration/presentation/messagesLiveWindow.test.ts`
- `src/features/messages/components/Messages.live-behavior.test.tsx`
- 无新增依赖，无 backend/API/data migration 影响。
