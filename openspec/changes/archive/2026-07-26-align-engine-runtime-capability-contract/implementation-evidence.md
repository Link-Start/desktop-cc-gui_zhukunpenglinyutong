# Implementation Evidence

## Contract inventory

- Rust/daemon `EngineFeatures` wire fields: `reasoningEffort`, `collaborationMode`,
  `imageInput`, `sessionResume`, `toolsControl`, `streaming`, `mcp`.
- TypeScript DTO owns the same field names. `reasoning`, `toolUse`,
  `sessionContinuation` remain decode-only compatibility aliases.
- OpenSpec fixture owns 15 spec stance cells for each built-in engine.
- Generated TypeScript/Rust artifacts remove production imports from
  `openspec/**`.

## Foundation calibration

- `Kimi` and `OpenCode` `input.mid-turn`: `unsupported`; both runtimes close or
  disable interactive stdin.
- `Codex`/`Claude` `input.mid-turn`: `compat-input`; current client can route
  compatible input but does not claim native steering parity.
- `rpc.server`: `Codex` supported; other CLI engines unsupported.
- Unprobed runtime fields remain `unknown` with `runtime:evidence-missing`.

## Verification

- `node scripts/check-engine-capability-matrix.mjs`
- focused Vitest: `engineCapabilityMatrix.test.ts`
- focused Rust: `engine::capability_matrix::tests`
- `pnpm tsc --noEmit --pretty false`
