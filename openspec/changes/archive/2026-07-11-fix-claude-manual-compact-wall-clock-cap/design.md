## Context

Manual Claude `/compact` is handled in two duplicated places: the Tauri path
(`src-tauri/src/codex/mod.rs::compact_claude_thread`) and the daemon path
(`src-tauri/src/bin/cc_gui_daemon/runtime_helpers.rs`). Both wrap the single
`session.send_message(params, &turn_id)` call in a fixed 120s
`tokio::time::timeout` keyed on `CLAUDE_MANUAL_COMPACT_TIMEOUT_SECS`. On a large
conversation, the compaction summarization legitimately exceeds 120s, and since
the cap measures total wall-clock (not time-since-last-event) it aborts a
healthy run and maps the elapsed error to `Claude /compact timed out after 120
seconds`.

Two existing guards already cover the real hang case, making the outer cap
redundant: `send_message` (`claude.rs`) enforces a 90s first-event watchdog, and
the auto-compaction path (`lifecycle.rs`) awaits the same send without any outer
cap.

## Goals / Non-Goals

**Goals:**

- Let a legitimate long manual compaction complete rather than being killed by a
  total-duration wall.
- Keep the first-event watchdog as the single, correct guard against a true
  hang.
- Match manual `/compact` duration handling to the already-uncapped
  auto-compaction path.

**Non-Goals:**

- No new timeout knob or env var.
- No change to `send_message`'s watchdog or to `lifecycle.rs`.
- No change to routing, side-effect guards, or feedback strings.

## Decisions

1. Remove the outer cap rather than raise it.
   - Option A (chosen): delete the `timeout()` wrapper and await
     `send_message` directly in both handlers; remove the dead
     `CLAUDE_MANUAL_COMPACT_TIMEOUT_SECS` const and the now-unused `timeout`
     import in `runtime_helpers.rs`.
   - Option B: increase `CLAUDE_MANUAL_COMPACT_TIMEOUT_SECS`.
   - Trade-off: A removes the false-timeout class entirely and drops a redundant
     guard; B only moves the cliff and still guesses a magic number. A is the
     smaller, fully revertable diff.

2. Rely on the first-event watchdog for hang protection.
   - `send_message`'s 90s watchdog already fails fast when the runtime never
     responds; keeping a second total-duration wall on top of it both duplicates
     the guard and misclassifies healthy long runs as hangs.

3. Apply the change identically in both duplicated handlers.
   - The Tauri and daemon paths must not diverge in compaction duration
     semantics; both drop the wrapper so behavior is uniform regardless of which
     path executes the command.

## Risks / Trade-offs

- [Risk] A pathological runtime that emits an early event then streams forever
  would no longer be wall-capped on the manual path.
  - Mitigation: this failure mode is not observed; the watchdog covers a true
    stall, and the auto-compaction path already accepts the same trade-off.
- [Risk] Removing the `timeout` import could leave an unused import and break the
  Rust build.
  - Mitigation: `runtime_helpers.rs` still uses `Duration` (health probe), and
    `codex/mod.rs` still uses `timeout`/`Duration` for other operations; verified
    no orphaned imports remain, guarded by `cargo test`.

## Migration Plan

1. Author the OpenSpec proposal / design / spec delta / tasks.
2. Delete the `timeout()` wrapper, dead const, and unused import in both
   handlers; await `send_message` directly.
3. Run `cargo test`, `npm run typecheck`, and `openspec validate --strict`.
4. Rollback restores the two touched files; no runtime-state migration involved.

## Open Questions

- None.
