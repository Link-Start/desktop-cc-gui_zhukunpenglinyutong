## Status

Implementation complete; pending sync/archive.

## Evidence

- Follow-up protocol evidence: current generated `ThreadItem` union contains `{ type: "subAgentActivity", kind, agentThreadId, agentPath }`; parent `threadId` comes from the enclosing `item/started` / `item/completed` notification。
- Follow-up RED: linking tests initially received zero dispatches，item event test showed `workspaceId` was dropped。
- Follow-up GREEN: `useThreadLinking.test.tsx` + `useThreadItemEvents.test.ts` passed 46/46 tests；file-scoped ESLint 与 `git diff --check` passed。
- Follow-up scope: 按用户要求未运行 repository-wide tests、global typecheck 或 production build。

- Protocol evidence: local `codex-cli 0.144.6 app-server generate-ts --experimental` generated `ThreadStartedNotification = { thread: Thread }`; `Thread` includes `parentThreadId` and `agentNickname`, while nested `SessionSource.subagent.thread_spawn` carries `agent_path` compatibility evidence.
- RED: initial hook/reducer run failed 3 tests with 131 passing because `ensureThread` omitted parent/name and preview renamed the child to `我`.
- RED: refresh/path coverage failed when nested source metadata was ignored and `setThreads` dropped the live relationship.
- RED: explicit-title and engine-alias regressions failed before relationship/name authority and engine precedence were separated.
- GREEN focused regression: 7 suites / 173 tests passed, covering live events、thread list summary projection、reducer idempotency、engine alias、tree rows、Sidebar 与 ThreadList。
- Standard test suite: `npm test` completed all 879 test files with exit code 0; heavy `*.integration.test.tsx` suites remain excluded by the repository's standard command.
- Targeted heavy integration: `useThreads.integration.test.tsx` passed 24/24 tests.
- Static/contracts: `npm run typecheck`、`npm run lint`、`npm run check:runtime-contracts` 与 `git diff --check` passed.
- Production build: `npm run build` passed; existing CSS-property、dynamic-import 与 chunk-size warnings remain unchanged.
- OpenSpec: `openspec validate fix-codex-subagent-live-sidebar-convergence --strict --no-interactive` passed.
- Repository-wide OpenSpec: 431 items passed; the sole failure is the pre-existing `fix-claude-cli-native-installer` requirement-text error, unrelated to this change.
- Large-file report: `npm run check:large-files` exited 0 in report mode; the new focused files remain below thresholds and the oversized legacy test was not enlarged.

## Remaining Risks

- Older Codex runtime 若同时缺少 top-level 与 nested live relationship fields，仍依赖 existing catalog fallback，可能保留旧的短暂收敛行为。
- 未在真实 packaged desktop 中手工启动一组 Codex multi-agent；当前 evidence 来自 protocol schema、event-order regression、Sidebar tree tests 与 production build。
- Repository-local consistency wrapper 依赖缺失的 `~/.claude/skills/osp-openspec-sync/scripts/validate-consistency.py`，因此 full consistency command 未执行。
