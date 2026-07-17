## 1. OpenSpec Artifacts

- [x] 1.1 Author proposal/design/spec delta/tasks for the default-mode AskUserQuestion MCP bridge; output: change dir under `openspec/changes/add-askuserquestion-default-mode-mcp-bridge`; validation: `openspec validate add-askuserquestion-default-mode-mcp-bridge --strict --no-interactive`. [P0][I][O: change dir][V: openspec validate]

## 2. In-process MCP server (Rust)

- [x] 2.1 `askuser_mcp.rs`: in-process MCP server exposing one `AskUserQuestion` tool; `mcp_config_json(workspace_id)` + `allowed_tool_name()`; global start via `init_askuser_mcp_global`. [P0][I][O: askuser_mcp.rs][V: cargo (F4)]
- [x] 2.2 `user_input.rs`: route an MCP-origin ask to the live turn subscriber; await the answer via per-request oneshot; settle on completed. [P0][I][O: user_input.rs][V: cargo (F4)]
- [x] 2.3 `claude.rs`: in non-plan modes inject `--mcp-config` + allowed tool, set `MCP_TOOL_TIMEOUT=300000` unless user-set; `mcp_answer_waiters` map on manager state. [P0][I][O: claude.rs][V: tests_stream]
- [x] 2.4 `events.rs` / `manager.rs` / `event_conversion.rs` / `lib.rs`: `completed` lifecycle on `RequestUserInput`, manager plumbing, app-setup server start. [P0][I][O: engine files][V: cargo (F4)]

## 3. Composer queue hold (frontend)

- [x] 3.1 `app-shell.tsx`: derive `hasPendingUserInput` scoped by `workspace_id` + `thread_id` (empty thread_id = current); thread it into `useComposerController`. [P0][I][O: app-shell.tsx][V: typecheck]
- [x] 3.2 `useComposerController.ts`: accept + forward `hasPendingUserInput`. [P0][I][O: useComposerController.ts][V: typecheck]
- [x] 3.3 `useQueuedSend.ts`: hold the queue while `hasPendingUserInput`; release on settlement. [P0][I][O: useQueuedSend.ts][V: vitest]

## 4. Tests / gates

- [x] 4.1 `tests_stream.rs`: guard that `MCP_TOOL_TIMEOUT` is raised when the ask is wired (`build_command_raises_mcp_tool_timeout_when_ask_wired`). [P0][I][O: tests_stream.rs][V: cargo (F4)]
- [x] 4.2 `useQueuedSend.test.tsx`: queue-hold-while-pending regression. [P0][I][O: useQueuedSend.test.tsx][V: vitest]
- [x] 4.3 `cargo test --manifest-path src-tauri/Cargo.toml` passed on 2026-07-18. [P0][V: cargo]
- [x] 4.4 Manual in-app retest replaced by deterministic coverage: Rust preserves `multiSelect`; dialog tests cover multi-select interaction; `useQueuedSend.test.tsx` covers pending hold and post-settlement flush; answer normalization tests cover structured settlement. Governance waiver recorded in `verification.md`. [P1][V: automated waiver]
