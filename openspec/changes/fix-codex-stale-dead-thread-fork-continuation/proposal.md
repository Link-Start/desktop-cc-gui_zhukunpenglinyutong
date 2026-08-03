## Why

Codex 历史会话打开后常出现 `thread not found` 恢复卡，文案要求用户点 **Fork**。但卡上的 Fork 只调用裸 `startFork` → Codex 原生 `thread/fork(parentId)`。当父 thread 已在 app-server 失效时，native fork 同样失败，前端再 **静默 `return null`**，用户感知为「点 Fork 没用」。发送路径里已有 fork→fresh 阶梯，恢复卡主 CTA 却没接上。

## 目标与边界

- **目标**：stale-thread 恢复卡上的主 CTA（Fork）在父 thread 已死时仍能落到**可用会话**（native fork 优先，失败则显式 fresh continuation）。
- **目标**：失败必须可见，禁止静默 no-op。
- **边界**：仅 Codex / 分类为 `thread-not-found` / `session-not-found` 的恢复卡 Fork 路径；不改 Claude/Shared 主语义。
- **边界**：不承诺所有历史 Codex thread 永久可 resume；只保证「主 CTA 可继续干活」。

## 非目标

- 不重写 Codex history / rollout / session storage。
- 不静默把 durable 老会话 rebind 到任意新 thread 并伪装成「原会话已恢复」。
- 不把 broken-pipe / workspace-not-connected 等非 stale-binding 路径改成 fork/fresh。
- 不在本变更强制做本地历史全文投影到 fresh thread（可后续增强）。
- 不提交 git（由用户验收后再提交）。

## What Changes

- 恢复卡 Fork 从裸 `startFork("/fork")` 改为 **continuation orchestration**：`native fork →（失败）fresh thread + activate`，返回 classified outcome。
- 复用 `forkThreadForWorkspace` / `startThreadForWorkspace` 与 `manualThreadRecovery` 既有阶梯，不平行造 fork 实现。
- Fork 失败（null / throw）在恢复场景 MUST 表面化为卡片错误或等价可见反馈；成功 MUST 切换到可用 thread。
- 文案小幅诚实化：建议下一步说明「优先 Fork，失败则新建会话承接」。
- 补齐 targeted tests：dead parent + fork null → fresh 成功；双失败 → 可见 failed。

## Capabilities

### New Capabilities

- （无）本变更只修正既有 stale recovery 行为。

### Modified Capabilities

- `codex-stale-thread-binding-recovery`: 恢复卡 Fork 主路径 MUST 在 native fork 不可用时显式 fresh continuation，且 MUST NOT 静默失败；修正「仅调用 shared startFork / 禁止任何 fallback」的过时要求。

## 技术方案对比

| 选项 | 做法 | 优点 | 缺点 | 结论 |
|------|------|------|------|------|
| A. 只改文案「请新建会话」 | 不修按钮 | 成本低 | 主 CTA 仍失效 | 否 |
| B. Fork 失败后 fresh continuation（推荐） | 卡上 Fork 走 fork→fresh 编排 | 复用已有阶梯、可继续干活、范围可控 | fresh 不继承完整 native 上下文 | **采用** |
| C. 本地历史重建 + 新 thread 注入 | 投影幕布历史到新会话 | 上下文更好 | 工作量大、契约未稳 | 后续可选 |

## Impact

- Frontend orchestration:
  - `src/app-shell-parts/manualThreadRecovery.ts`
  - `src/app-shell-parts/useAppShellLayoutNodesSection.tsx`
  - `src/app-shell-parts/useAppShellLayoutNodesSection.recovery.test.ts`
- Recovery card / wiring:
  - `src/features/messages/components/recovery/RuntimeReconnectCard.tsx`（若需 outcome 展示）
  - `src/features/messages/components/Messages.runtime-reconnect.test.tsx`
- i18n:
  - `src/i18n/locales/zh/messages.ts`、`en/messages.ts`（及必要同步 locale）
- OpenSpec:
  - `openspec/changes/fix-codex-stale-dead-thread-fork-continuation/**`
  - delta: `specs/codex-stale-thread-binding-recovery/spec.md`

## 验收标准

1. 对已 `thread not found` 的 Codex 会话，点恢复卡 **Fork**：若 native fork 成功 → 激活 fork 子会话；若 native fork 失败/null → **创建并激活 fresh Codex 会话**，不得停在原死 thread 且无反馈。
2. fork 与 fresh 均失败时，卡片 MUST 显示失败态（非静默）。
3. 成功路径 MUST 切换 `activeThreadId` 到可用会话，用户可立即输入。
4. recover-and-resend / 自动发送路径既有 fork→fresh 行为保持，不被本变更破坏。
5. 非 Codex / 非 stale-thread 恢复卡路径不被污染。
6. targeted Vitest 通过；用户本地检查前 **不 git commit**。
