# Implementation Evidence

## Duplication inventory and owner

- Frontend hardcoded owners found in `useEngineController`、
  `engineAvailability`、web runtime fallback and composer preference
  normalization. These now consume `engineRegistry.ts`.
- Rust exhaustive `EngineType` remains the privileged built-in dispatcher.
  `adapter_registry.rs` owns opaque `EngineId`、source info、protocol family、
  execution model and external registration validation.
- Daemon reuses the Rust registry through `engine_bridge.rs`; realtime prefix
  scanning reuses `engineIds.json`.

## Adapter / protocol / lifecycle

- `EngineProtocol` exposes executable、execution model and wire parsing only.
  It has no frontend/session mutation surface.
- `EngineAdapter` owns engine identity、declared capability profile and mapping
  wire output to `EngineEvent`.
- `Kimi`/Claude-style protocols are registered as `one-shot`;
  Codex app-server is `persistent`.
- Existing `RuntimeManager` remains the single lifecycle owner. Its
  generation/replacement guards reject stale runtime-end evidence and preserve
  the successor process; this batch reuses that owner instead of adding a
  parallel process registry.

## Governance

- `check-engine-adapter-registry.mjs` validates the five built-ins、entry
  coverage、frontend/Rust contract tokens and registry-backed branch scanner.
- External engine id、provenance and duplicate validation have frontend and
  Rust fixtures.

## Verification

- focused Vitest: registry、availability、controller、composer prefs.
- focused Rust: adapter registry and RuntimeManager generation/replacement.
- daemon compile、TypeScript compile、strict OpenSpec validation.
