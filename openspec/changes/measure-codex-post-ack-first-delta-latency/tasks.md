## 1. Backend Timing

- [x] 1.1 Add bounded per-thread Codex turn timing state around `turn/start`.
- [x] 1.2 Enrich Codex app-server event params with content-safe `ccguiTiming`.
- [x] 1.3 Clear timing state on terminal turn events.

## 2. Renderer Diagnostics

- [x] 2.1 Extend `noteThreadAppServerEventReceived` to preserve Codex backend phase fields.
- [x] 2.2 Add tests for content-safe backend timing diagnostics and malformed field normalization.

## 3. Report

- [x] 3.1 Add `codexPostAckFirstDeltaP95` from `stream-latency/app-server-event`.
- [x] 3.2 Add comparison notes across first-delta, turn-start ack, and post-ack first-delta wait.

## 4. Validation

- [x] 4.1 Run OpenSpec validate.
- [x] 4.2 Run focused Rust, Vitest, and Node report tests.
- [x] 4.3 Run typecheck, lint, and diff check.
