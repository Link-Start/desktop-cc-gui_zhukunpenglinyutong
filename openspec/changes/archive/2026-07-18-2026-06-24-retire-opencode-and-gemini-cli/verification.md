# Verification: 2026-06-24-retire-opencode-and-gemini-cli

## Status

**OBSOLETE / SUPERSEDED — FORCE-ARCHIVE CANDIDATE**.

## Current Code Reality

- `EngineType::Gemini` and `EngineType::OpenCode` remain in the Rust engine model.
- Gemini/OpenCode session catalog and legacy compatibility paths remain.
- Rust engine adapters and `src/features/opencode/**` remain.
- Product-facing settings/provider/Git/MCP entry points were partially removed.

## Correctness Decision

The original hard-delete spec is not implemented. Its target version (`v0.5.14`)
has passed, and applying the remaining 44 tasks now would contradict the current
compatibility surface. This is not an incomplete implementation to resume; it is
a superseded product decision.

## Archive Decision

Force archive **without syncing delta specs**. Preserve the old artifacts only
as audit history. A future hard retirement requires a new, bounded change and an
explicit legacy-session migration policy.
