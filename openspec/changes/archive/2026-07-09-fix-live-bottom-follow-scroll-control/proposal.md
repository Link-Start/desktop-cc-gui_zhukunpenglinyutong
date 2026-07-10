# Proposal: Fix Live Bottom Follow Scroll Control

## Why

Commit `4271504933b6ac3a350dfbd821e29f9cfaf5af99` fixed a regression created after live assistant body text moved through `liveAssistantTextChannel`: streaming deltas no longer changed reducer item identity, so the old `scrollKey`-driven auto-follow effect did not fire during a turn.

Existing changes only partially cover this area:

- `fix-live-auto-follow-rearm-scroll` covers re-arming focus follow after the user toggles live follow back on.
- `add-message-anchor-bottom-jump` covers a bottom jump affordance in the anchor rail.

This commit introduced a different behavior contract: bottom-follow must be driven by real visible content height changes, and navigation should be represented by a floating `ScrollControl` rather than the anchor rail bottom button.

## What Changes

- Add a floating `ScrollControl` for message navigation, supporting back-to-top and back-to-bottom actions.
- Remove the anchor rail bottom button and keep the anchor rail focused on message/user-turn anchors.
- Drive bottom-follow from actual timeline size changes via `ResizeObserver`, rather than relying only on reducer item identity or `scrollKey`.
- Gate auto-follow through a follow window covering streaming, settle repin, and initial bottom pin behavior.
- Release auto-follow when the user intentionally scrolls upward.
- Replace `bottomRef.scrollIntoView` with direct `scrollTop` writes so container padding-bottom is included in the final scroll position.
- Render the anchor rail from a single anchor instead of requiring two anchors.
- Strip `cat -n` line numbers before rendering Read tool output as markdown.
- Tighten tool marker shell body radius and adjust message status shell styling for the new scroll control.
- Make the ResizeObserver test mock triggerable/configurable so tests can simulate content height growth.

## Non-Goals

- Do not change live assistant text externalization itself; that is covered by `externalize-live-assistant-text-channel`.
- Do not change message ordering, grouping, or history hydration semantics.
- Do not introduce backend/Tauri scroll state.
- Do not make auto-follow forcibly override deliberate user scroll-away behavior.
- Do not remove the existing anchor rail user-message navigation behavior.

## Impact

- Affected specs:
  - `conversation-render-surface-stability`
  - `message-reading-navigation-reasoning-ux`
- Affected code from the commit:
  - `src/features/messages/components/Messages.tsx`
  - `src/features/messages/components/ScrollControl.tsx`
  - `src/features/messages/components/MessagesAnchorRail.tsx`
  - `src/features/messages/components/messagesViewModel.ts`
  - `src/features/messages/components/messagesConstants.ts`
  - `src/features/messages/components/toolBlocks/ReadToolBlock.tsx`
  - `src/features/messages/components/toolBlocks/ToolMarkerShell.tsx`
  - `src/styles/messages.status-shell.css`
  - `src/styles/messages.part1-shell.css`
  - `src/i18n/locales/en.part1.ts`
  - `src/i18n/locales/zh.part1.ts`
  - `src/test/vitest.setup.ts`

## Behavior Requirements

- During active streaming, bottom-follow SHALL react to actual rendered timeline height growth, even when conversation item identity and `scrollKey` do not change.
- Auto-follow SHALL remain gated: streaming, settle repin, and initial bottom pin may keep the viewport at bottom; deliberate wheel-up/user scroll-away SHALL release follow.
- Back-to-bottom action SHALL scroll to the true bottom including container padding, not just the bottom sentinel position.
- Back-to-top action SHALL allow quick navigation to the top of the message surface without disabling normal later follow behavior.
- Anchor rail SHALL remain dedicated to message anchors and SHALL NOT own the floating bottom navigation affordance.
- Read tool markdown rendering SHALL ignore `cat -n` line prefixes so numbered shell output does not pollute rendered file content.
- ResizeObserver-dependent behavior SHALL be testable through a configurable mock.

## Validation

- `src/features/messages/components/ScrollControl.test.tsx`
- `src/features/messages/components/Messages.live-behavior.test.tsx`
- `src/features/messages/components/Messages.history-loading.test.tsx`
- `src/features/messages/components/Messages.test.tsx`
- TypeScript typecheck and focused messages rendering tests.

## Risks / Mitigations

- Risk: ResizeObserver-driven follow can fight the user's manual scroll position.
  - Mitigation: release follow on upward wheel/user scroll and only keep follow inside explicit follow windows.
- Risk: direct `scrollTop` writes can diverge across browsers if container metrics are not stable.
  - Mitigation: derive the target from the scroll container's own dimensions and cover it in jsdom tests with a triggerable ResizeObserver mock.
- Risk: moving bottom navigation out of the anchor rail can regress discoverability.
  - Mitigation: provide a dedicated floating control with localized accessible labels and keep anchor rail behavior intact.
