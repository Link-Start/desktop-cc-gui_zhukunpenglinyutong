## 1. OpenSpec Artifacts

- [x] 1.1 Author proposal + spec delta + tasks for the Claude runtime MCP servers panel; output: `openspec/changes/add-claude-runtime-mcp-servers-panel`; validation: `openspec validate add-claude-runtime-mcp-servers-panel --strict --no-interactive`. [P0][I][O: change dir][V: openspec validate]

## 2. Frontend (McpSection.tsx)

- [x] 2.1 Add `claudeRuntimeServers` state populated from `getClaudeMcpRuntimeSnapshot(workspaceId)` in the panel load sequence (guarded by `canCommit()`). [P0][I][O: McpSection.tsx][V: typecheck]
- [x] 2.2 Render the runtime-servers card when `selectedEngine === "claude"`: server rows (name + status), `built-in` badge for `ccgui`, `statusUnknown` fallback, and the `noRuntimeServers` empty state. [P0][I][O: McpSection.tsx][V: typecheck]

## 3. i18n

- [x] 3.1 Add `settings.mcpPanel.runtimeServersClaudeDesc` and `settings.mcpPanel.builtInBadge` to both `en.part1.ts` and `zh.part1.ts`; reuse existing `runtimeServersTitle` / `noRuntimeServers` / `statusUnknown` keys. [P0][I][O: en/zh.part1.ts][V: en↔zh parity]

## 4. Gates

- [x] 4.1 `npm run typecheck`. [P0][V: typecheck]
- [ ] 4.2 Manual: select the Claude engine with an active workspace; the runtime-servers card lists the reported servers and badges `ccgui` — DEFERRED to runtime QA (no McpSection render test exists). [P1][V: manual]
