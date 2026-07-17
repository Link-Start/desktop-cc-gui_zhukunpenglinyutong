## Context

The CLI exposes native `AskUserQuestion` only in plan mode; in `default` /
`acceptEdits` it is permission-gated. We want the same one-tap, mid-turn ask in
the modes people actually work in, without forking the CLI or a kill/resume cycle.

## Approach

**Re-expose the capability as an in-process MCP tool.** The CLI happily calls MCP
tools in any mode when they are on the allowed list, so we run a tiny in-process
MCP server (`askuser_mcp.rs`) that offers a single `AskUserQuestion` tool. The
command build (`claude.rs`) injects it via `--mcp-config` and allow-lists the tool
in non-plan modes only (plan mode already has the native tool).

**Reuse, don't rebuild, the UI + response path.** An MCP-origin ask is dispatched
(`user_input.rs`) onto the same `RequestUserInput` event/card path the rest of the
spec already governs — so multi-question tabs, secret handling, collapse/skip and
stale-settlement all come for free. The user's submitted answer is returned to the
originating call as the MCP `tool_result` (a per-request oneshot in
`mcp_answer_waiters`), so the live turn simply continues.

## Key decisions

- **`MCP_TOOL_TIMEOUT=300000`.** The CLI's per-request MCP fetch timeout defaults
  to 60s for HTTP MCP servers; a human answer routinely exceeds that. We raise it
  for the wired command, but never override an explicit user value.
- **No `--strict-mcp-config`.** Adding it would suppress the user's own MCP
  servers from `~/.claude.json`; our injection is deliberately additive.
- **Queue-hold, not queue-flush.** While a dialog is open the turn is blocked; a
  flush would send queued messages as fresh turns and strand the answer. The
  frontend derives `hasPendingUserInput` (workspace + thread scoped) and
  `useQueuedSend` holds the queue until settlement.
- **`claude`-only.** All wiring is gated on the claude engine; Codex / opencode /
  gemini paths are untouched.

## Risks / deferred

- `cargo test` + the in-app multiSelect-with-queue retest are **deferred to freeze
  window F4** (no local rebuilds during the freeze). The command-build guard test
  (`build_command_raises_mcp_tool_timeout_when_ask_wired`) encodes the timeout
  contract in the meantime.
- The daemon path (`respond_to_server_request`) does not route Claude user-input
  today (live build uses the Tauri handler); a guard is worth adding if daemon
  mode grows, but is out of scope here.
