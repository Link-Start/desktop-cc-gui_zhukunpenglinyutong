## Why

The MCP settings panel lists the servers declared in the user's config, but
Claude also receives MCP servers injected at spawn via `--mcp-config` — most
notably the app's own built-in `ccgui` AskUserQuestion bridge. Those never
appear in the config list, so the panel could not answer the question a user
actually asks it: *which MCP servers is Claude connected to right now?* Claude
reports its live server set in the init event, which the app already captures in
a per-workspace runtime snapshot; the panel just needs to surface it.

## 目标与边界

- When the Claude engine is selected, show a read-only "runtime servers" card
  listing the MCP servers Claude reported at init (name + status), sourced from
  the existing `getClaudeMcpRuntimeSnapshot(workspaceId)` snapshot.
- Mark the app's built-in `ccgui` server with a "built-in" badge so users can
  tell it apart from their own configured servers.
- Show an explicit empty state when the snapshot has no servers (or none yet
  captured for the workspace).

## 非目标

- Do not add, edit, remove, or otherwise mutate MCP servers from this card — it
  is display-only.
- Do not introduce a new IPC/Rust surface: reuse the runtime snapshot the init
  path already records.
- Do not change the Codex/OpenCode server cards or the config-declared list.

## 技术方案对比

- **Option A — read the existing runtime snapshot (chosen).** `McpSection` reads
  `getClaudeMcpRuntimeSnapshot(workspaceId)` on load and renders the reported
  servers. Zero backend work, accurate to what Claude actually connected to.
- **Option B — re-probe MCP config files.** Parse the merged `--mcp-config` and
  user config to reconstruct the injected set. Rejected: duplicates spawn logic,
  drifts from reality, and still cannot report per-server connection status.

## What Changes

- `src/features/settings/components/McpSection.tsx`: add a `claudeRuntimeServers`
  state populated from `getClaudeMcpRuntimeSnapshot(workspaceId)` during the
  panel load sequence, and render a runtime-servers card when
  `selectedEngine === "claude"` (server rows with name + status, a `built-in`
  badge for `ccgui`, and an empty state).
- `src/i18n/locales/{en,zh}.part1.ts`: add `settings.mcpPanel.runtimeServersClaudeDesc`
  and `settings.mcpPanel.builtInBadge` (the card reuses the existing
  `runtimeServersTitle` / `noRuntimeServers` / `statusUnknown` keys).

## 验收标准

- With the Claude engine selected, the panel renders one runtime-server row per
  entry in the workspace's runtime snapshot; an empty/absent snapshot renders the
  empty-state message.
- The `ccgui` server row carries the built-in badge; other servers do not.
- A server with no reported status renders the `statusUnknown` fallback.
- Every new i18n key exists in both `en` and `zh`. `npm run typecheck` passes.

## Spec deltas

- `claude-runtime-mcp-servers-panel` (new capability): **ADDED** — the MCP
  settings panel MUST surface Claude's runtime-reported MCP servers (read-only),
  badge the built-in `ccgui` server, and show an empty state when none are
  reported.
