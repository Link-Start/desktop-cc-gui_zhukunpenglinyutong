# client-renderer-stability-under-pressure Specification

## Purpose
TBD - created by archiving change harden-client-renderer-stability-under-pressure. Update Purpose after archive.
## Requirements
### Requirement: Renderer heartbeat MUST provide a backend-observable liveness signal
The system SHALL emit a privacy-safe renderer heartbeat that lets the backend distinguish normal renderer activity from missed heartbeat windows.

#### Scenario: heartbeat is recorded without content
- **WHEN** the renderer heartbeat is sent
- **THEN** the backend MUST record timestamp, platform, app version, active workspace/thread identifiers when available, and diagnostic support flags
- **AND** the heartbeat payload MUST NOT include prompt text, assistant text, tool output, file content, environment values or screenshots

#### Scenario: heartbeat misses are classified
- **WHEN** the backend does not receive the renderer heartbeat within the configured threshold
- **THEN** the system MUST record a bounded `renderer.heartbeat_missed` or equivalent diagnostic
- **AND** the diagnostic MUST distinguish heartbeat evidence from confirmed native process crash evidence

### Requirement: Renderer process failure evidence MUST be feature-detected by platform
The system SHALL capture native renderer process failure or unresponsive evidence when the current platform and WebView stack expose a supported hook.

#### Scenario: native hook is supported
- **WHEN** the platform reports renderer process failure, browser/web process exit, or equivalent unresponsive event
- **THEN** the system MUST record event kind, platform, timestamp, recovery eligibility, and any safe exit reason/code exposed by the platform
- **AND** the system MUST NOT require prompt/body content to diagnose the event

#### Scenario: native hook is unsupported
- **WHEN** a platform does not expose a safe renderer process failure hook
- **THEN** the system MUST record the hook support state as `unsupported` or `not-implemented`
- **AND** heartbeat/watchdog evidence MUST remain available as the portable fallback

### Requirement: Renderer pressure snapshots MUST be bounded and redacted
The system SHALL attach bounded renderer pressure snapshots to stability diagnostics so long-run white-screen cases can be investigated without leaking user content.

#### Scenario: pressure snapshot is emitted
- **WHEN** renderer heartbeat misses, process failure, unresponsive state, or recovery is recorded
- **THEN** the system MUST include bounded metadata for active engine count, active streaming turn count, background helper process count when supported, memory/long-task support status, and current recovery attempt count
- **AND** the diagnostic store MUST cap repeated snapshots by label and time window

### Requirement: Renderer recovery MUST use backoff and preserve user context
The system SHALL only attempt renderer reload or rebuild recovery through a bounded policy that records evidence before recovery.

#### Scenario: recovery is attempted
- **WHEN** a renderer failure is classified as recoverable
- **THEN** the system MUST record the failure evidence before attempting reload or rebuild
- **AND** repeated recovery attempts MUST use a bounded backoff
- **AND** unsent Composer draft state MUST be preserved or the user MUST see a clear diagnostic recovery state

#### Scenario: recovery is blocked
- **WHEN** recovery attempts exceed the configured limit or required state cannot be preserved
- **THEN** the system MUST stop automatic recovery
- **AND** the user MUST be shown a diagnostic state instead of entering an infinite reload loop

### Requirement: Renderer Pressure Diagnostics MUST Include Resource Retention Evidence

Renderer stability diagnostics SHALL include bounded, privacy-safe evidence for long-running resource retention that can degrade interaction smoothness.

#### Scenario: long-running client reports resource-owner counts

- **WHEN** the renderer records a pressure snapshot during or after repeated realtime turns
- **THEN** the snapshot MUST include bounded support/count fields for active listeners, timers, RAF or idle callbacks, canvas render caches, and diagnostics buffer pressure when available
- **AND** the snapshot MUST NOT include prompt text, assistant text, tool output, file content, environment values, or screenshots

#### Scenario: stale resource cleanup is observable

- **WHEN** a workspace/thread/canvas scope is torn down
- **THEN** diagnostics or tests MUST be able to prove owned listeners/timers/caches are released, cancelled, or bounded
- **AND** late callbacks MUST be guarded against post-teardown state writes

### Requirement: Conversation Render Failures MUST Be Classified And Contained Locally

Renderer stability under pressure MUST classify conversation-local render failures, including React #185 / update-loop-style failures, without leaking conversation content and without unnecessary full-app failure escalation.

#### Scenario: React update-loop style failure is diagnosed content-safely
- **WHEN** a conversation row, heavy Markdown island, tool-card detail, diff detail, anchor rail, or popover triggers a React #185 / maximum update depth style failure
- **THEN** diagnostics MUST record a content-safe failure entry with component surface, workspace id, thread id, row kind, engine when known, render weight, and bounded stack/classification data
- **AND** diagnostics MUST NOT include prompt text, assistant body text, tool output body, diff body, file content, screenshots, or environment values

#### Scenario: local fallback prevents global crash when possible
- **WHEN** the failure is contained by a conversation-local boundary
- **THEN** the app shell, Composer, navigation, and other conversation rows MUST remain usable
- **AND** the local fallback MUST expose a recoverable retry or rehydrate path where safe

#### Scenario: repeated local failures are backoff-limited
- **WHEN** the same row or heavy island repeatedly fails after retry or rehydrate attempts
- **THEN** automatic retries MUST stop after a documented limit
- **AND** diagnostics MUST record the blocked recovery state instead of entering an infinite render/reload loop

### Requirement: Conversation Measurement And Overlay Updates MUST Be Loop-Guarded

Conversation renderer measurement, anchor, tooltip, and popover logic MUST avoid unbounded state-update loops under heavy histories and MUST release long-lived resources when the conversation changes.

#### Scenario: repeated measurement updates are bounded
- **WHEN** virtualization measurement, row resize observation, anchor readiness, tooltip placement, or popover placement receives repeated equivalent values
- **THEN** the renderer MUST avoid redundant state writes for unchanged effective state
- **AND** any forced remeasure path MUST have a documented per-row or per-frame bound

#### Scenario: overlay and measurement diagnostics are content-safe
- **WHEN** a repeated measurement, anchor, tooltip, or popover update-loop guard is triggered
- **THEN** diagnostics MUST record surface, row kind, counter, threshold, and component classification data
- **AND** diagnostics MUST NOT include prompt text, assistant body text, tool output body, diff body, file content, screenshots, or environment values

#### Scenario: long-running conversation resources are released
- **WHEN** the selected thread changes, a heavy row unmounts, lightweight mode changes, or an async hydration/precompute request becomes stale
- **THEN** observers, timers, pending callbacks, hydration queue entries, and measurement cache entries associated with the stale surface MUST be released or ignored
- **AND** diagnostics SHOULD expose bounded live resource counts without conversation content

### Requirement: Optional Render Diagnostics MUST Fail Safe

Production render diagnostics MUST NOT trap the client in a persistent startup or reload loop when their instrumentation amplifies a React maximum-update-depth failure.

#### Scenario: persisted react-scan overlay encounters React #185

- **WHEN** the persisted react-scan overlay is enabled
- **AND** the global renderer boundary catches `Maximum update depth exceeded` or minified React error `#185`
- **THEN** the client MUST clear the optional react-scan startup state
- **AND** it MUST retry once without react-scan instrumentation
- **AND** repeated recovery MUST be bounded to prevent an automatic reload loop

#### Scenario: unrelated renderer error keeps normal recovery

- **WHEN** the global renderer boundary catches an error outside the maximum-update-depth class
- **THEN** the client MUST retain the normal ErrorBoundary details and manual reload path
- **AND** it MUST NOT disable react-scan solely because an unrelated component failed

#### Scenario: persisted overlay cleanup fails

- **WHEN** the client cannot clear the persisted react-scan startup state
- **THEN** it MUST roll back the one-shot recovery guard so a later attempt remains possible
- **AND** it MUST retain the normal ErrorBoundary path and record a content-safe recovery-failure diagnostic

### Requirement: Cold-start sibling projections MUST NOT publish workspace-derived equivalent state

AppShell cold-start hooks MUST keep persisted/event-owned source snapshots separate from workspace-derived projections. An equivalent `workspaces` collection reference change MUST NOT schedule a React state update, and a real storage or workspace catalog change MUST still update the visible projection.

#### Scenario: Equivalent workspace catalog is recreated during hydration

- **WHEN** cold-start hydration recreates a `workspaces` array with the same ordered `id/name` values
- **THEN** Quick Switcher recent-file source state MUST retain its previous reference
- **AND** AppShell MUST NOT reach React `Maximum update depth exceeded` or minified error `#185`

#### Scenario: Storage changes before the listener is attached

- **WHEN** a sibling cold-start effect updates recent-file storage before the Quick Switcher listener effect attaches
- **THEN** the post-subscription refresh MUST observe the latest normalized snapshot exactly once
- **AND** the visible recent-file groups MUST include the real change

#### Scenario: Workspace name changes

- **WHEN** a workspace keeps its identity but its observable name changes
- **THEN** the projected recent-file group MUST publish the new workspace name
- **AND** no client-store schema migration MUST be required

### Requirement: AppShell Feature Projections MUST Not Create Parent Render Feedback Loops

AppShell feature hooks that mirror storage or derived collections into local React state MUST preserve the previous state reference when the observable projection is unchanged, even when an input collection receives a new reference.

#### Scenario: Equivalent workspace projection remains idempotent

- **WHEN** an AppShell render supplies a newly allocated `workspaces` array with unchanged ids and names
- **AND** Quick Switcher recent-file storage has not changed
- **THEN** `useQuickSwitcherRecentFiles` MUST preserve its previous groups reference
- **AND** the effect MUST NOT schedule an unbounded parent render chain or React error #185

#### Scenario: A real recent-file transition still publishes

- **WHEN** Quick Switcher receives `QUICK_SWITCHER_RECENT_FILES_CHANGED`
- **AND** the projected recent-file groups differ from current state
- **THEN** the hook MUST publish the new groups
- **AND** the matching recent file MUST remain visible through the Quick Switcher surface

#### Scenario: AppShell startup converges with empty activity

- **GIVEN** startup has a valid empty `workspaceActivity.timeline`
- **AND** shell section inputs may be reconstructed between renders
- **WHEN** AppShell initializes Quick Switcher recent-file state
- **THEN** startup MUST converge without `Maximum update depth exceeded` or heap exhaustion

