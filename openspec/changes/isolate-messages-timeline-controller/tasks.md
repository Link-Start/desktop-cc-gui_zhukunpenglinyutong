## 1. Lock current behavior
- [x] 1.1 Run projection、virtualization、hydration and virtualized-jump regression suites.
- [x] 1.2 Add a failing test for stable keyed measurement callback identity.

## 2. Extract row dispatch
- [x] 2.1 Move projection-row switch and row-specific props to `TimelineRowRenderer.tsx`.
- [x] 2.2 Preserve DOM wrappers、keys、measurement refs、error boundaries and live probes.
- [x] 2.3 Implement stable keyed callback-ref registry and pass focused tests.

## 3. Extract state owners
- [x] 3.1 Move virtualizer construction、measurement、scope reset and stability recovery to `useMessagesTimelineVirtualizer`.
- [x] 3.2 Move heavy-row hydration、promotion、retention and bounded remeasure to `useMessagesTimelineHydration`.
- [x] 3.3 Move outline snapshots、stable callback、active heading and disabled listener behavior to `useMessagesTimelineOutline`.

## 4. Compose and verify
- [x] 4.1 Reduce `MessagesTimeline.tsx` to projection + owner composition and keep it below 1600 lines.
- [x] 4.2 Run focused timeline/live suites and the full messages suite.
- [x] 4.3 Run typecheck、full lint、build、boundary、large-file evidence、diff check and independent review.
- [x] 4.4 Record line counts、review evidence and baseline qualifiers.
