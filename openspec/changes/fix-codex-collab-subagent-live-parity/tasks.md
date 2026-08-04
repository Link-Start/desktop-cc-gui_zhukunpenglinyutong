## 1. OpenSpec Artifacts

- [x] 1.1 Author proposal / design / specs / tasks for Codex collab live parity. [P0][O: openspec/changes/fix-codex-collab-subagent-live-parity][V: openspec validate]

## 2. Tests first (RED)

- [x] 2.1 Add unit tests for Codex-native synthetic inject eligibility: wait-only + 3 children → inject; has spawn with receivers → no inject; Claude/Grok native children → no inject. [P0][O: syntheticSharedSubagentTools.test.ts][V: vitest]
- [x] 2.2 Add StatusPanel tests: Codex wait without receiver ids + child parent map → Agents list non-empty; non-Codex engine → no child-tree fallback. [P0][O: useStatusPanelData.test.ts][V: vitest]
- [x] 2.3 Add collab receiver extraction test: live-shaped item with `targets`/`ids` → `receiverThreadIds`. [P1][O: threadItems.test.ts][V: vitest]
- [x] 2.4 Add dedupe test: synthetic + later real spawn same agentId → single card. [P0][O: syntheticSharedSubagentTools.test.ts][V: vitest]

## 3. Implementation (GREEN)

- [x] 3.1 Extract `shouldInjectChildSubagentSynthetic` with engine / thread / items / children inputs; default deny non-Codex. [P0][O: syntheticSharedSubagentTools.ts][V: unit]
- [x] 3.2 Wire `useMessagesPresentationState` to inject child synthetic for Codex native live gap (not only `shared:`). [P0][O: useMessagesPresentationState.ts][V: vitest GREEN]
- [x] 3.3 StatusPanel Codex child-tree fallback when collab agentIds empty. [P0][O: useStatusPanelData.ts][V: vitest GREEN]
- [x] 3.4 Align live collab receiver field extraction with history (`targets`/`target`/`ids`). [P1][O: threadItems.ts / collabToolParsing][V: vitest GREEN]
- [x] 3.5 Ensure synthetic vs real spawn dedupe rank prefers real collab tool. [P0][O: subagentViewModel.ts][V: vitest GREEN]

## 4. Regression lock (other CLIs)

- [x] 4.1 Confirm existing Grok Shared synthetic tests still pass without assertion drift. [P0][V: vitest]
- [x] 4.2 Confirm Claude Agent/Task and Kimi swarm isSubagentTool / groupToolItems tests pass. [P0][V: vitest]
- [ ] 4.3 Manual smoke: one Claude realtime multi-agent (or Agent tool) and one Grok spawn path — no visual regression. [P0][V: manual]

## 5. Gates

- [x] 5.1 `openspec validate fix-codex-collab-subagent-live-parity --strict --no-interactive` [P0]
- [x] 5.2 Focused vitest for touched modules [P0]
- [x] 5.3 `npm run typecheck` [P0]
- [ ] 5.4 Manual Codex multi-agent live: wait phase shows squad + Agents tab; after end history matches. [P0][V: manual]

## 6. Out of scope checklist

- [x] 6.1 Confirm wait is still non-persona (no isCollabLifecycleTool behavior change unless tests require). [P0]
- [x] 6.2 No changes to Claude/Grok/Kimi realtime adapters or history loaders. [P0]
