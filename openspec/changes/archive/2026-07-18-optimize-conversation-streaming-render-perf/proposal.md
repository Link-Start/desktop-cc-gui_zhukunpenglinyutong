## Why

On the WebKitGTK renderer, streaming a response was janky: an audit found the
main thread doing per-token work and continuous repaints. Four distinct hotspots
each re-did work that could be cached, coalesced, or moved off the main thread —
history rescans per token, superseded snapshots all flushed, per-frame CSS
paints, and full DOM recreation of Bash
output on every new line. Individually small; together they starved input and
pinned CPU during streaming.

## 2026-07-18 代码校准

- **裁定：实现完成，建议归档**。四项优化均已存在于当前代码：history derivation cache、drop-policy guarded snapshot coalescing、compositor-friendly CSS、Bash absolute-line DOM reuse。
- `src/services/events.test.ts` 已覆盖 coalescing 的 drop-eligible / non-drop-eligible 边界；其余改动是受 guard 保护的局部 fast path，不改变 settled rendering。
- 原任务 `6.3` 的 rebuilt-app trace 已被后续 `enable-claude-lightweight-streaming-and-frame-attribution` 与 `harden-conversation-rendering-for-large-history` 吸收。继续为本 change 单独保留一套人工 trace 没有新增判定价值，按 governance waiver 关闭。
- 本 change 归档时同步 delta specs；后续真实性能测量只在 large-history closure change 记录。

## 目标与边界

- Cut per-token main-thread work and continuous repaint **during streaming**,
  without changing settled (idle) rendering or correctness.
- Each fix is guarded so the idle / non-streaming path falls back to the existing
  full-correctness computation.
- Reuse existing engines/policies (the event drop-eligibility policy) rather than
  adding new machinery.

## 非目标

- Do not change what is rendered when a message is settled (full markdown, full
  dedup) — only the transient streaming path.
- Do not alter the streaming protocol, event schema, or Tauri/IPC surface.
- Do not touch the deferred theme-CSS `recalculate-styles` cost (separate,
  larger refactor).
- No new dependency.

## What Changes

Four targeted fixes on the messages streaming path:

1. **History-scan caching (`Messages.tsx`)** — cache
   `dedupeExitPlanItemsKeepFirst` / `buildMessageActionTargets` across streaming
   ticks so they no longer rescan the full history per token. Fast path fires only
   when a trailing message-text-only update is detected; otherwise falls back to a
   full recompute (idle correctness preserved).
2. **Snapshot coalescing (`events.ts`)** — coalesce `item/updated` snapshots per
   `(workspace, thread, item)` so superseded full-text snapshots in one flush tick
   collapse to the newest, guarded by the existing drop-eligibility policy.
3. **Compositor-friendly animations (CSS)** — replace per-frame main-thread
   paints with compositor equivalents: working-text shimmer
   (`background-position` under text-clip → `opacity`), ingress spinner glow
   (animated `filter: drop-shadow` → static `box-shadow`), agent-icon idle (drop a
   redundant `drop-shadow` that duplicated `text-shadow`).
4. **Bash output DOM reuse (`BashToolBlock` / `BashToolGroupBlock`)** — key output
   lines by absolute line index so the sliding truncation window reuses DOM
   instead of recreating the whole visible list per line.

## Capabilities

### New Capabilities

- `conversation-streaming-render-performance`: performance invariants for the
  conversation streaming render path — no per-token full-history rescans,
  coalesced superseded snapshots, compositor-only streaming animations, and DOM
  reuse for the Bash truncation window.

### Modified Capabilities

- None (adds invariants without changing existing observable contracts).

## Impact

- Frontend only: `Messages.tsx`,
  `toolBlocks/BashToolBlock.tsx`, `toolBlocks/BashToolGroupBlock.tsx`,
  `services/events.ts` (+ test), `styles/messages.part1.css`,
  `styles/messages.status-shell.css`.
- Runtime/API: no protocol, schema, IPC, or Rust change. Dependencies: none.

## 技术方案对比

| 选项 | 做法 | 取舍 |
|---|---|---|
| Recommended: guarded fast-paths on existing machinery | Cache/coalesce/reuse with a fallback to the current full computation on the idle path | Smallest diff; idle correctness untouched; reuses the event drop policy already in the codebase | 
| Alternative: rewrite the streaming pipeline | A single new streaming renderer that owns dedup/markdown/coalescing | Larger, riskier, and duplicates engines that already exist; the four hotspots are independently shippable and independently verifiable |

## 验收标准

- During streaming, per-token work does not rescan full history; the idle path
  still produces identical dedup/action-target results (fast-path fallback).
- Superseded `item/updated` snapshots in one flush tick collapse to the newest
  only when the drop policy allows.
- Streaming animations run on the compositor (no per-frame main-thread paint).
- Bash sliding-window output reuses DOM rows across new lines.
- `events.test.ts`, `npm run typecheck`, and `openspec validate
  optimize-conversation-streaming-render-perf --strict --no-interactive` pass.
