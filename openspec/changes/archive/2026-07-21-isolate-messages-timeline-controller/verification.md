# Verification

## Status

Completed on 2026-07-21.

## Behavior Lock

- 变更前 focused baseline：4 files，52 tests passed，5 skipped。
- keyed callback-ref 先增加 failing regression，再实现 stable identity 与 latest delegate。
- review 发现 streamed task notification 的 mounted-node metadata resync 缺口后，增加
  `useTimelineMessageNodeRefs.test.tsx`，覆盖旧 task/tool identity 清理与新 identity 注册。

## Ownership Result

- `MessagesTimeline.tsx`：700 lines，只保留 projection、owner composition、diagnostics 与 viewport wiring。
- `TimelineRowRenderer.tsx`：780 lines，负责 projection-row dispatch、row-specific prop mapping 与 error boundary。
- `useMessagesTimelineVirtualizer.ts`：372 lines，拥有 virtualizer construction、measurement、empty-row resize、pending jump、scope reset 与 stability recovery。
- `useMessagesTimelineHydration.ts`：拥有 heavy-row promotion、retention 与 bounded remeasure lifecycle。
- `useMessagesTimelineOutline.ts`：拥有 outline snapshot、stable live callback、active heading 与 disabled listener contract。
- `useTimelineMessageNodeRefs.ts`：拥有 stable keyed refs 与 mounted-node task/tool mapping resync。

## Automated Evidence

- Focused timeline/live/rich-content：13 files passed；95 tests passed，5 skipped。
- Full messages suite：69 files passed；610 tests passed，7 skipped。
- `npm run test`：passed；874 test files completed，repository default excludes heavy `*.integration.test.tsx` suites。
- `npm run typecheck`：passed。
- `npm run lint`：passed。
- `npm run build`：passed；仅保留仓库既有 CSS property、dynamic import 与 chunk-size warnings。
- `npm run check:messages-boundaries`：passed；inbound 3/3，outbound 60/61，removed 1，new 0。
- `npm run check:large-files:ci`：completed successfully；repository known baseline remains 51 findings。
- `npm run check:large-files:gate`：expected exit 1 because the same 51 repository baseline findings remain；本 change 未新增 finding。
- `git diff --check`：passed。
- `openspec validate isolate-messages-timeline-controller --strict`：passed。

## Review

- First independent `codex review --uncommitted`：reported one P2 task-card ref synchronization regression。
- 修复后 second independent review：no discrete correctness、security or maintainability issues。

## Baseline Qualifiers

- `SHOW_OUTLINE_FLOATER = false` 继续向 `useMessageOutlineActive` 传入 disabled input，不注册 window scroll/resize listener。
- live row 更新仍在 row-local component/hook 内完成；未恢复 root-level per-delta state update。
- new production files 均低于 800-line ratchet；`TimelineRowRenderer.tsx` 最终为 780 lines。
- strict large-file gate 的非零退出仅代表仓库已知 51 条 baseline，不代表本 change 新增违规。
