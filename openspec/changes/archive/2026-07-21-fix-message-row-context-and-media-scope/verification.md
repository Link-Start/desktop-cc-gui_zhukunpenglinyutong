# Verification

## Status

**READY FOR ARCHIVE** — correctness implementation、review closure 与 automated
regression gates 已完成。

## RED Evidence

- `MessagesRows.stream-mitigation.test.tsx`：新增 browser / intent-canvas
  attachment-only rerender tests 后，旧 comparator 出现 `2 failed / 22 passed`。
- `Messages.rich-content.test.tsx`：workspace scope 切换后旧 hydration completion
  覆盖新 row，新增 race test 在旧实现上失败。

## Implementation Evidence

- `areMessageItemsEqual` 显式比较 `browserContextAttachment`，并逐项比较
  `intentCanvasContextAttachments` identity。
- deferred image key 包含 `workspacePath + threadId + messageId + locator`；每个
  request 记录 monotonic `requestId`。
- async completion 在 create object URL 前后与 state updater 内重复验证 committed
  scope 和 generation；stale/unmount completion 不提交 state。
- renderer-owned transient object URL 在 stale completion、scope/item cleanup 与
  unmount 时释放。
- review 指出的 render-phase ref publication 已修复：current key set 只在
  `useLayoutEffect` commit 后发布；同 scope generation race 有独立 regression test。

## Verification Evidence

- Focused GREEN：2 files / 46 tests passed。
- Messages suite：77 files passed；702 tests passed；7 skipped。
- `npm run typecheck`：exit 0。
- `npm exec eslint -- src/features/messages --ext .ts,.tsx`：exit 0，0 warning。
- `npm run check:messages-boundaries`：exit 0；inbound 38、outbound 70、new 0。
- `openspec validate fix-message-row-context-and-media-scope --strict --no-interactive`：exit 0。
- `git diff --check`：exit 0。

## Baseline Qualifier

`npm run check:large-files:gate` 仍 exit 1，并报告与 Phase 0 baseline 相同的 51
个 repository-wide findings。当前输出未列出 `MessagesRows.tsx` production source；
该 gate failure 已在未修改 Phase 1 production code 的 baseline 上复现，不归因于
本 change，也未通过扩大 baseline 或 wildcard waiver 隐藏。
