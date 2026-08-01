# Normalize Conversation Presentation Context

## OpenSpec

- Change: `normalize-conversation-presentation-context`
- Roadmap: Phase 7 of `2026-07-21-messages-high-cohesion-low-coupling-roadmap.md`

## Goal

将 browser-agent、intent-canvas、project-memory、note-cards 的 raw injected prompt parsing 从 messages renderer 移到
conversation assembly/history boundaries，并通过 optional `presentationMetadata` 保持 realtime/history display parity。

## Acceptance Criteria

- Shared conversation types include a neutral context union and message presentation metadata.
- Realtime assembly and supported history loaders produce equivalent metadata.
- Messages presentation uses metadata first and has one legacy fallback adapter.
- Row/presentation modules have zero direct parser imports from the four producer features.
- Focused parity/history/messages tests、runtime contracts、lint、typecheck、build and boundary checks pass.
