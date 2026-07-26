# Implementation Evidence

## Identity inventory

- `logicalSessionId`: stable client conversation identity.
- `nativeSessionId`: engine-owned resumable session identity.
- `pendingSessionId`: pre-promotion compatibility identity.
- `runId`, `turnId`, `itemId`: independent correlation identities.
- Built-ins covered: `Claude`, `Codex`, `Gemini`, `Kimi`, `OpenCode`.

## Boundary

- `engineRuntimeIdentity.ts` is the sole new legacy prefix parser.
- Existing `threads.threadAliases` remains the durable alias owner. Chains are
  flattened; late events resolve to the canonical id; stored tombstones are
  bounded to 2,000 entries.
- Diagnostics, replay, common realtime adapter, item events and turn events now
  consume the shared parser.
- Engine branch scanner loads the canonical engine id artifact and now covers
  `Kimi`.

## Verification

- focused Vitest: identity, alias, debug correlation and capability tests.
- `node --test scripts/scan-engine-name-branches.test.mjs`
- `pnpm tsc --noEmit --pretty false`
