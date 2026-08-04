---
type: guide
status: active
---

# Codex Collaboration Mode Enforcement Runbook

> **内容类型**：Troubleshooting / Runbook
> **生命周期**：active
> **最后校准**：2026-08-03 · mossx `0.7.16`
> **事实源**：`src-tauri/src/backend/app_server_plan_enforcement.rs`、`src-tauri/src/codex/collaboration_policy.rs`、settings types
> **更新触发器**：Collaboration policy、blocked event、settings 或 Codex app-server protocol 变化
> **导航**：[`README.md`](README.md) · [`../../README.md`](../../README.md)

## Scope

This runbook describes rollout, verification, and rollback for runtime
enforcement of Codex collaboration modes (`plan` / `code`).

## Control surface

- App setting key: `codexModeEnforcementEnabled`
- Codex config feature flag key: `features.collaboration_mode_enforcement`
- Default: `true`

App settings are the supported operator control. The backend resolves the effective setting when it creates or reconnects a Codex session. Do not depend on removed dedicated read/write IPC names.

## Runtime Behavior

- `turn/start` computes a thread-level `effective_mode` and records metadata:
  - `selectedMode`
  - `effectiveMode`
  - `policyVersion`
  - `fallbackReason`
- In `code` mode, backend blocks `item/tool/requestUserInput` and emits:
  - `collaboration/modeBlocked`
- In `plan` mode, `requestUserInput` continues as normal.
- Under the strict local collaboration profile, `plan` mode also blocks repository-mutating tool activity and emits the same event with a plan read-only reason.

## Verification Checklist

1. Start a Codex thread in `plan` mode and confirm `requestUserInput` still renders.
2. Switch to `code` mode and trigger `requestUserInput`.
3. Confirm no interactive request card appears.
4. Confirm a mode-blocked hint is rendered in the message area.
5. Confirm logs contain enforcement decision and turn/start mode metadata.
6. Start a `plan` turn, attempt a repository-mutating action, and confirm the read-only blocked event.

Example log probes:

```bash
rg -n "turn/start\\]\\[collaboration_mode\\]|collaboration_mode_enforcement" src-tauri
```

## Rollback Procedure

1. Disable the flag:
   - Set `codexModeEnforcementEnabled=false` in app settings.
2. Restart app or reconnect workspace session.
3. Re-verify that `requestUserInput` is no longer blocked in `code` mode.

## Troubleshooting

- Symptom: `requestUserInput` remains blocked after disabling flag.
  - Check session reconnection happened (flag is session-applied).
  - Check config/settings effective value is actually `false`.
- Symptom: no `collaboration/modeBlocked` event but request card absent.
  - Inspect raw `app-server-event` stream for malformed event payload.
  - Verify thread mode state exists for the current `threadId`.
