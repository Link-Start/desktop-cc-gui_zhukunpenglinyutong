## Context

Claude reports the servers actually connected at runtime in its init event. The client already stores that evidence per workspace, while the settings panel previously showed only config-declared servers and therefore omitted injected servers such as `ccgui`.

## Goals / Non-Goals

- Goal: expose the existing per-workspace Claude runtime snapshot as a read-only settings card.
- Goal: distinguish the built-in `ccgui` bridge and handle unknown status explicitly.
- Non-goal: mutate MCP configuration or create a new backend/IPC contract.
- Non-goal: infer runtime truth by reparsing config files.

## Decisions

### Decision: runtime snapshot is the source of truth

`getClaudeMcpRuntimeSnapshot(workspaceId)` is consumed during the existing panel load sequence. The existing commit guard prevents stale async loads from updating a replaced workspace view.

### Decision: runtime and configured servers remain separate views

The runtime card answers “what Claude reported as connected now.” The configured list answers “what the user declared.” They must not be merged because their status, ownership, and mutation semantics differ.

### Decision: the card is intentionally read-only

Rows expose server name and reported status. `ccgui` receives a built-in badge; missing status uses the existing unknown-state copy; absent snapshots render an explicit empty state.

## Risks / Trade-offs

- Snapshot evidence can be absent before Claude init; the empty state must not imply configuration deletion.
- A workspace switch during load can expose stale data unless the existing `canCommit()` guard remains in the path.
- Manual runtime QA remains necessary because no focused `McpSection` render test currently exercises the complete snapshot flow.

## Verification

1. Select Claude with an active workspace whose init snapshot contains `ccgui` and at least one user server.
2. Verify row count, statuses, built-in badge isolation, and the empty/unknown fallbacks.
3. Verify the card has no mutation controls and no new IPC dependency.
4. Run `openspec validate add-claude-runtime-mcp-servers-panel --strict --no-interactive`.
