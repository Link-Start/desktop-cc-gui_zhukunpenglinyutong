## Why

Manual `/compact` on a Claude thread wraps `session.send_message` in a fixed
120s `tokio::time::timeout` (`CLAUDE_MANUAL_COMPACT_TIMEOUT_SECS`). `/compact`
is an LLM summarization over the entire conversation and legitimately takes
minutes on a large context. Because the cap is a total-duration wall — not a
watchdog — progress events cannot extend it, so a healthy long compaction is
aborted mid-run and the user sees a false `Claude /compact timed out after 120
seconds` failure. The outer cap is also redundant: `send_message` already has a
90s first-event watchdog guarding a true hang, and the auto-compaction path
(`lifecycle.rs`) runs uncapped. This weakens conformance with
`claude-manual-compact-command`, whose feedback contract assumes a legitimate
compaction reaches its existing success lifecycle rather than a spurious
terminal error.

## 目标与边界

- Remove the fixed 120s wall-clock cap around manual Claude `/compact` in both
  duplicated handlers so a legitimate long compaction runs to completion.
- Preserve the existing hang protection: `send_message`'s 90s first-event
  watchdog remains the guard against a runtime that never responds.
- Bring manual `/compact` duration handling into parity with the uncapped
  auto-compaction path.
- Keep all existing routing, side-effect guards, lifecycle feedback, and
  terminal-failure semantics of `claude-manual-compact-command` unchanged.

## 非目标

- Do not introduce a new configurable timeout or environment variable.
- Do not change the auto-compaction path (`lifecycle.rs`) — it is already
  uncapped and out of scope.
- Do not alter `send_message`'s internal first-event watchdog value or behavior.
- Do not change command routing, image/side-effect guards, or user-facing
  feedback strings.

## What Changes

- Drop the `timeout(...)` wrapper in both duplicated manual-compact handlers
  (`src-tauri/src/codex/mod.rs::compact_claude_thread` and
  `src-tauri/src/bin/cc_gui_daemon/runtime_helpers.rs`), awaiting
  `session.send_message` directly.
- Remove the now-dead `CLAUDE_MANUAL_COMPACT_TIMEOUT_SECS` const from both files
  and the now-unused `timeout` import in `runtime_helpers.rs`.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `claude-manual-compact-command`: add a duration requirement stating manual
  `/compact` MUST NOT be aborted by an arbitrary wall-clock cap, and that hang
  protection is provided by the first-event watchdog rather than a total wall.

## Impact

- Runtime/API: `src-tauri/src/codex/mod.rs`, and
  `src-tauri/src/bin/cc_gui_daemon/runtime_helpers.rs`. No Tauri command
  signature, IPC, or storage schema change.
- Frontend: none.
- Dependencies: no new dependency.

## 技术方案对比

| 选项 | 做法 | 取舍 |
|---|---|---|
| Recommended: remove the outer cap | Delete the `timeout()` wrapper + dead const/import; rely on the existing 90s first-event watchdog | Fixes the false-timeout on large contexts; matches the uncapped auto-compaction path; smallest, revertable diff. Trade-off: a runtime that streams useless progress forever would not be wall-capped — but that failure mode is not observed and the watchdog covers a true stall |
| Alternative: raise the cap | Bump `CLAUDE_MANUAL_COMPACT_TIMEOUT_SECS` to a larger value | Still a total-duration wall that guesses a "large enough" number; any sufficiently large context still gets falsely killed, and it keeps a redundant guard alongside the watchdog |

## 验收标准

- Manual `/compact` on a large Claude context no longer fails at ~120s and
  reaches the existing compacting / compacted lifecycle feedback.
- A runtime that never emits a first event is still surfaced as a failure by the
  existing 90s watchdog (behavior unchanged).
- No unused imports or dead consts remain; `cargo test` and `npm run typecheck`
  pass; `openspec validate fix-claude-manual-compact-wall-clock-cap --strict
  --no-interactive` passes.
